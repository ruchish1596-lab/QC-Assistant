const LOG_URL = "https://script.google.com/macros/s/AKfycbzSihN-ZnLwVtIfA_c9Mij1a6b7Hx6d2tUYe11ut6zNaVshEvMiW5bb9gPELROkkY-p/exec";
const EXTENSION_VERSION = "2.0.0-dev2";

let latestCSV = "";
let latestResponse = null;
let latestUser = "";
let latestTabUrl = "";

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
}

const emailInput = document.getElementById("qcEmail");
const emailError = document.getElementById("emailError");
const runButton = document.getElementById("runQC");
const PW_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@pw\.live$/i;

chrome.storage.local.get(["qcUser"], data => {
  if (data.qcUser) emailInput.value = data.qcUser;
  validateEmailField();
});

emailInput.addEventListener("input", validateEmailField);

function validateEmailField() {
  const email = String(emailInput.value || "").trim();
  const valid = PW_EMAIL_REGEX.test(email);
  emailError.style.display = email && !valid ? "block" : "none";
  runButton.disabled = !valid;
  return valid;
}

function sendLog(payload) {
  fetch(LOG_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCSV(response) {
  const rows = response.reportRows || [];
  let csv = "Priority,Type,Question No,Rule ID,Check,Status,Details,Admin Answer,Solution Answer,Options Count,Video Solution\n";
  rows.forEach(r => {
    csv += [
      r.priority, r.type, r.qno, r.ruleId, r.check, r.status,
      r.details, r.adminAnswer, r.solutionAnswer, r.optionsCount, r.videoSolution
    ].map(csvEscape).join(",") + "\n";
  });
  return csv;
}

function addReportRow(response, row) {
  if (!response.reportRows) response.reportRows = [];
  response.reportRows.push({
    priority: row.priority || "Critical",
    type: row.type || "Question",
    qno: row.qno || "-",
    ruleId: row.ruleId || "-",
    check: row.check || "-",
    status: row.status || "ERROR",
    details: row.details || "-",
    adminAnswer: row.adminAnswer || "-",
    solutionAnswer: row.solutionAnswer || "-",
    optionsCount: row.optionsCount ?? "-",
    videoSolution: row.videoSolution || "-"
  });
}

function sortRows(response) {
  const p = { Critical: 1, Error: 2, Warning: 3, Info: 4, Pass: 5 };
  const t = { Test: 1, Question: 2 };
  response.reportRows = (response.reportRows || []).sort((a, b) => {
    const pd = (p[a.priority] || 9) - (p[b.priority] || 9);
    if (pd) return pd;
    const td = (t[a.type] || 9) - (t[b.type] || 9);
    if (td) return td;
    const qa = Number(a.qno), qb = Number(b.qno);
    if (!Number.isNaN(qa) && !Number.isNaN(qb)) return qa - qb;
    return String(a.ruleId).localeCompare(String(b.ruleId));
  });
}

function finalizeCounts(response) {
  sortRows(response);
  response.errorCount = (response.reportRows || []).filter(r => r.status === "ERROR").length;
  response.warningCount = (response.reportRows || []).filter(r => r.status === "WARNING").length;
  response.questionsWithErrors = new Set((response.reportRows || []).filter(r => r.type === "Question" && r.status === "ERROR").map(r => String(r.qno))).size;
  response.passCount = Math.max(0, response.questionsFound - response.questionsWithErrors);
  response.csv = buildCSV(response);
}

function getErrorDetails(response) {
  return (response.reportRows || [])
    .filter(r => r.status === "ERROR")
    .map(r => `${r.ruleId} ${r.type} ${r.qno}: ${r.details}`)
    .join(" | ");
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/^q?\s*\d+[\.)]?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function readExcelAnswerKey(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const map = {};
        rows.slice(1).forEach(row => {
          const qno = Number(row[0]);
          const ans = String(row[1] || "").trim().toUpperCase();
          if (qno && ["A", "B", "C", "D"].includes(ans)) map[qno] = ans;
        });
        resolve(map);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readPdfText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray, disableWorker: true }).promise;
        let fullText = "";
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          const textContent = await page.getTextContent();
          let pageText = "";
          textContent.items.forEach(item => { pageText += item.str + (item.hasEOL ? "\n" : " "); });
          fullText += "\n" + pageText;
        }
        resolve(fullText);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function readPdfAnswerKey(file) {
  const fullText = await readPdfText(file);
  const map = {};
  const answerKeyText = fullText.split(/Hints\s*&\s*Solutions/i)[0];
  const regex = /Q\s*(\d+)\s*\(?\s*([A-D])\s*\)?/gi;
  let m;
  while ((m = regex.exec(answerKeyText)) !== null) {
    const qno = Number(m[1]);
    const ans = m[2].toUpperCase();
    if (qno && ["A", "B", "C", "D"].includes(ans)) map[qno] = ans;
  }
  return map;
}

async function applyExcelCompare(response, file) {
  const map = await readExcelAnswerKey(file);
  response.questions.forEach(q => {
    const expected = map[q.qno];
    const admin = String(q.adminAnswer || "").trim().toUpperCase();
    if (expected && admin && admin !== "-" && expected !== admin) {
      addReportRow(response, { priority: "Critical", type: "Question", qno: q.qno, ruleId: "X001", check: "Excel Answer Compare", status: "ERROR", details: `Excel answer mismatch: Admin=${admin}, Excel=${expected}`, adminAnswer: admin, solutionAnswer: expected, optionsCount: q.optionsCount, videoSolution: q.videoSolution });
    }
  });
}

async function applyPdfCompare(response, file) {
  const map = await readPdfAnswerKey(file);
  response.questions.forEach(q => {
    const expected = map[q.qno];
    const admin = String(q.adminAnswer || "").trim().toUpperCase();
    if (expected && admin && admin !== "-" && expected !== admin) {
      addReportRow(response, { priority: "Critical", type: "Question", qno: q.qno, ruleId: "P001", check: "PDF Answer Compare", status: "ERROR", details: `PDF answer mismatch: Admin=${admin}, PDF=${expected}`, adminAnswer: admin, solutionAnswer: expected, optionsCount: q.optionsCount, videoSolution: q.videoSolution });
    }
  });
}

document.getElementById("runQC").addEventListener("click", async () => {
  const result = document.getElementById("result");
  if (!validateEmailField()) return;

  const qcEmail = String(emailInput.value || "").trim().toLowerCase();
  chrome.storage.local.set({ qcUser: qcEmail });

  result.innerHTML = "Running QC 2.0 DEV2... Please wait.";

  const expectedInput = document.getElementById("expectedCount")?.value;
  const manualExpectedQuestions = expectedInput ? Number(expectedInput) : null;
  const hasVideoSolutions = document.getElementById("hasVideoSolutions")?.checked === true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "RUN_QC_V2", options: { manualExpectedQuestions, hasVideoSolutions } }, async response => {
    if (chrome.runtime.lastError || !response) {
      result.innerHTML = "Admin page refresh karo, Preview Test & Questions ya Edit Test open karo, phir Run QC 2.0 dabao.";
      return;
    }

    const excelFile = document.getElementById("excelFile")?.files[0];
    if (excelFile) {
      try { await applyExcelCompare(response, excelFile); }
      catch { addReportRow(response, { priority: "Critical", type: "Test", qno: "-", ruleId: "X000", check: "Excel File", status: "ERROR", details: "Excel file could not be read" }); }
    }

    const pdfFile = document.getElementById("pdfFile")?.files[0];
    if (pdfFile) {
      try { await applyPdfCompare(response, pdfFile); }
      catch { addReportRow(response, { priority: "Critical", type: "Test", qno: "-", ruleId: "P000", check: "PDF File", status: "ERROR", details: "PDF file could not be read" }); }
    }

    finalizeCounts(response);
    latestCSV = response.csv || "";
    latestResponse = response;
    latestTabUrl = tab.url;
    latestUser = qcEmail;

    sendLog({
      user: latestUser,
      event: "RUN_QC",
      testUrl: latestTabUrl,
      questionsFound: response.questionsFound,
      passCount: response.passCount,
      errorCount: response.errorCount,
      warningCount: response.warningCount,
      imagesFound: response.imagesFound,
      downloaded: "No",
      errorDetails: getErrorDetails(response),
      extensionVersion: EXTENSION_VERSION
    });

    result.innerHTML = `
      <b>QC Report v2.0 DEV2</b><br><br>
      Questions Found: ${response.questionsFound}<br>
      Question Errors: ${response.questionsWithErrors}<br>
      Report Errors: ${response.errorCount}<br>
      Warnings: ${response.warningCount}<br>
      Images Found: ${response.imagesFound}<br><br>
      <button id="downloadReport">Download CSV Report</button>
    `;

    document.getElementById("downloadReport").addEventListener("click", () => {
      sendLog({
        user: latestUser || "Unknown",
        event: "DOWNLOAD_REPORT",
        testUrl: latestTabUrl,
        questionsFound: latestResponse.questionsFound,
        passCount: latestResponse.passCount,
        errorCount: latestResponse.errorCount,
        warningCount: latestResponse.warningCount,
        imagesFound: latestResponse.imagesFound,
        downloaded: "Yes",
        errorDetails: getErrorDetails(latestResponse),
        csvContent: latestCSV,
        extensionVersion: EXTENSION_VERSION
      });

      const blob = new Blob([latestCSV], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QC_Assistant_DEV2_Report_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
});
