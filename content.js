console.log("QC Assistant DEV3.3 Test Name Suffix Fix Loaded");

const QC_VERSION = "3.0.3-dev3-test-name-suffix-fix";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanText(text = "") {
  return String(text)
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function compactText(text = "") {
  return cleanText(text).replace(/\s+/g, " ").trim();
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return (
    rect.width > 8 &&
    rect.height > 8 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isPwLiveEmail(email = "") {
  const value = String(email || "").trim();
  if (!value) return true;
  return /^[a-zA-Z0-9._%+-]+@pw\.live$/i.test(value);
}

function reportRow({
  priority = "Critical",
  type = "Question",
  qno = "-",
  ruleId = "-",
  check = "-",
  status = "ERROR",
  details = "-",
  adminAnswer = "-",
  solutionAnswer = "-",
  optionsCount = "-",
  videoSolution = "-"
}) {
  return {
    priority,
    type,
    qno,
    ruleId,
    check,
    status,
    details,
    adminAnswer,
    solutionAnswer,
    optionsCount,
    videoSolution
  };
}

function sortReportRows(rows) {
  const p = { Critical: 1, Error: 2, Warning: 3, Info: 4, Pass: 5 };
  const t = { Test: 1, Question: 2 };

  return rows.sort((a, b) => {
    const pd = (p[a.priority] || 9) - (p[b.priority] || 9);
    if (pd) return pd;

    const td = (t[a.type] || 9) - (t[b.type] || 9);
    if (td) return td;

    const qa = Number(a.qno);
    const qb = Number(b.qno);

    if (!Number.isNaN(qa) && !Number.isNaN(qb)) return qa - qb;
    if (!Number.isNaN(qa)) return -1;
    if (!Number.isNaN(qb)) return 1;

    return String(a.ruleId).localeCompare(String(b.ruleId));
  });
}

function rootText(root) {
  return compactText(root?.innerText || root?.textContent || "");
}

function getPreviewRoot() {
  const titles = Array.from(document.querySelectorAll("mat-card-title")).filter(isVisible);
  if (!titles.length) return null;

  const first = titles[0];
  const dialog = first.closest("mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, [role='dialog']");

  if (dialog && isVisible(dialog)) return dialog;

  let el = first.parentElement;
  let best = null;

  while (el && el !== document.body && el !== document.documentElement) {
    if (isVisible(el)) {
      const count = el.querySelectorAll("mat-card-title").length;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const scrollable = el.scrollHeight > el.clientHeight + 60;

      if (count > 0 && area > 50000) {
        const score = count * 1000 + (scrollable ? 300 : 0) - area / 100000;
        if (!best || score > best.score) best = { el, score };
      }
    }

    el = el.parentElement;
  }

  return best?.el || null;
}

function getEditRoot() {
  const candidates = Array.from(document.querySelectorAll([
    "mat-dialog-container",
    ".mat-mdc-dialog-container",
    ".cdk-overlay-pane",
    "[role='dialog']",
    ".mat-drawer-content",
    ".mat-sidenav-content",
    "app-edit-test",
    "app-test-form"
  ].join(","))).filter(isVisible);

  const scored = candidates.map(el => {
    const text = rootText(el).toLowerCase();
    let score = 0;

    if (text.includes("duration in minutes")) score += 90;
    if (text.includes("total questions")) score += 90;
    if (text.includes("allow submit")) score += 90;
    if (text.includes("display order")) score += 25;
    if (text.includes("available for")) score += 25;
    if (text.includes("actions")) score += 20;
    if (text.includes("total marks")) score += 20;
    if (text.includes("syllabus")) score += 20;

    const formCombo =
      text.includes("duration in minutes") &&
      text.includes("total questions");

    if (!formCombo) score -= 200;

    const rect = el.getBoundingClientRect();
    score -= (rect.width * rect.height) / 2000000;

    return { el, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 70 ? scored[0].el : null;
}

function getScrollContainer(root) {
  if (!root) return null;

  const exact = Array.from(root.querySelectorAll("div")).find(el => {
    const cls = String(el.className || "");
    return cls.includes("relative") &&
      cls.includes("h-screen") &&
      cls.includes("overflow-y-auto") &&
      el.scrollHeight > el.clientHeight + 100;
  });

  if (exact) return exact;

  const dialog = root.matches?.("mat-dialog-container,.mat-mdc-dialog-container")
    ? root
    : root.closest?.("mat-dialog-container,.mat-mdc-dialog-container");

  if (!dialog) return null;

  const candidates = Array.from(dialog.querySelectorAll("*")).filter(el => {
    const style = getComputedStyle(el);
    return el.scrollHeight > el.clientHeight + 100 &&
      ["auto", "scroll"].includes(style.overflowY);
  });

  candidates.sort(
    (a, b) =>
      (b.scrollHeight - b.clientHeight) -
      (a.scrollHeight - a.clientHeight)
  );

  return candidates[0] || dialog;
}

async function autoScrollRoot(root) {
  const el = getScrollContainer(root);
  if (!el) return;

  const insidePreviewDialog =
    Boolean(el.closest?.("mat-dialog-container,.mat-mdc-dialog-container")) ||
    el.matches?.("mat-dialog-container,.mat-mdc-dialog-container");

  if (!insidePreviewDialog) return;

  el.scrollTop = 0;
  el.dispatchEvent(new Event("scroll", { bubbles: true }));
  await sleep(300);

  let previousTop = -1;
  let guard = 0;

  while (guard < 80) {
    previousTop = el.scrollTop;
    el.scrollTop = Math.min(el.scrollTop + 700, el.scrollHeight);
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(220);
    guard++;

    const reachedBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 5;

    const didNotMove =
      Math.abs(el.scrollTop - previousTop) < 2;

    if (reachedBottom || didNotMove) break;
  }

  el.scrollTop = 0;
  el.dispatchEvent(new Event("scroll", { bubbles: true }));
  await sleep(300);
}

function getOptionLetter(text = "") {
  const match = compactText(text).match(/^([A-D])[\.)]\s*/i);
  return match ? match[1].toUpperCase() : "";
}

function getSolutionAnswer(text = "") {
  const raw = compactText(text);

  if (/\banswer\s*:\s*[spdf]\s*block\b/i.test(raw)) return "";

  const patterns = [
    /\boption\s+([A-D])\s+is\s+the\s+correct\s+answer\b/i,
    /\boption\s+([A-D])\s+is\s+correct\b/i,
    /\boption\s+([A-D])\s+is\s+right\b/i,
    /\bhence[^.]{0,140}\boption\s+([A-D])\b[^.]{0,100}\bcorrect\s+answer\b/i,
    /\btherefore[^.]{0,140}\boption\s+([A-D])\b[^.]{0,100}\bcorrect\s+answer\b/i,
    /\bthe\s+correct\s+answer\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i,
    /\bcorrect\s+answer\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i,
    /\bright\s+answer\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i,
    /\banswer\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i,
    /\banswer\s*:\s*(?:option\s*)?([A-D])\b/i,
    /\bans\s*:\s*(?:option\s*)?([A-D])\b/i,
    /\bsolution\s+that\s+is\s+right\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i,
    /\bsolution\s+is\s*:?\s*(?:option\s*)?([A-D])\b/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return "";
}

function extractOptions(contentText = "") {
  const lines = String(contentText)
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const options = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([A-D])[\.)]\s*(.+)$/i);

    if (match) {
      options.push({
        letter: match[1].toUpperCase(),
        text: compactText(match[2])
      });
    } else if (/^[A-D][\.)]$/i.test(lines[i]) && lines[i + 1]) {
      options.push({
        letter: lines[i].replace(/[\.)]/g, "").toUpperCase(),
        text: compactText(lines[i + 1])
      });
    }
  }

  const unique = {};
  options.forEach(o => {
    if (!unique[o.letter]) unique[o.letter] = o;
  });

  return ["A", "B", "C", "D"].map(letter => unique[letter]).filter(Boolean);
}

function hasMeaningfulSolution(text = "") {
  const value = compactText(text).toLowerCase();

  const markers = [
    "solution",
    "explanation",
    "explaination",
    "key concept",
    "correct answer is",
    "right answer is",
    "answer is",
    "solution is",
    "option a is the correct answer",
    "option b is the correct answer",
    "option c is the correct answer",
    "option d is the correct answer"
  ];

  if (!markers.some(marker => value.includes(marker))) return false;

  const cleaned = value
    .replace(/the correct answer is:?\s*(option)?\s*[a-d]/gi, "")
    .replace(/correct answer is:?\s*(option)?\s*[a-d]/gi, "")
    .replace(/right answer is:?\s*(option)?\s*[a-d]/gi, "")
    .replace(/answer is:?\s*(option)?\s*[a-d]/gi, "")
    .replace(/option [a-d] is the correct answer/gi, "")
    .replace(/video solution/g, "")
    .replace(/none/g, "")
    .trim();

  return cleaned.length > 10;
}

function hasVideoSolution(contentEl) {
  if (!contentEl) return false;

  const selectors = [
    "video",
    "iframe",
    "a[href*='youtube']",
    "a[href*='youtu.be']",
    "a[href*='vimeo']",
    "a[href*='video']",
    "[class*='video']",
    "[src*='video']",
    "[src*='youtube']",
    "[src*='vimeo']"
  ];

  return selectors.some(selector => contentEl.querySelector(selector));
}

function imageWarnings(contentEl) {
  const warnings = [];
  if (!contentEl) return warnings;

  Array.from(contentEl.querySelectorAll("img")).forEach((img, idx) => {
    const label = `Image ${idx + 1}`;

    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      warnings.push(`${label} may be broken/not loaded`);
      return;
    }

    if (img.naturalWidth < 80 || img.naturalHeight < 80) {
      warnings.push(`${label} resolution too small (${img.naturalWidth}x${img.naturalHeight})`);
    }

    const parent = img.parentElement;

    if (parent) {
      const ps = getComputedStyle(parent);
      const ir = img.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const hidden =
        ps.overflow === "hidden" ||
        ps.overflowX === "hidden" ||
        ps.overflowY === "hidden";

      if (hidden && (ir.bottom > pr.bottom + 2 || ir.right > pr.right + 2)) {
        warnings.push(`${label} may be cropped/cut`);
      }
    }
  });

  return warnings;
}

function extractQuestions(root, options = {}) {
  if (!root) return { questions: [], reportRows: [] };

  const titles = Array.from(root.querySelectorAll("mat-card-title")).filter(isVisible);
  const contents = Array.from(root.querySelectorAll("mat-card-content"));
  const questions = [];
  const rows = [];

  titles.forEach((title, index) => {
    const questionText = compactText(title.innerText || "");
    const contentEl = contents[index];
    const contentText = contentEl?.innerText || "";
    const greenOptions = contentEl
      ? Array.from(contentEl.querySelectorAll(".bg-green-200, .bg-green-100, [class*='green']"))
      : [];

    const adminAnswers = greenOptions.map(opt => getOptionLetter(opt.innerText)).filter(Boolean);
    const solutionAnswer = getSolutionAnswer(contentText);
    const opts = extractOptions(contentText);
    const videoStatus = hasVideoSolution(contentEl) ? "Attached" : "Missing";

    const qnoMatch =
      questionText.match(/^\s*(?:Q\s*)?(\d+)[\.)]\s+/i) ||
      questionText.match(/\b(?:Q\s*)?(\d+)[\.)]\s+/i);

    const qno = qnoMatch ? Number(qnoMatch[1]) : index + 1;

    const q = {
      qno,
      question: questionText,
      options: {
        A: opts.find(o => o.letter === "A")?.text || "",
        B: opts.find(o => o.letter === "B")?.text || "",
        C: opts.find(o => o.letter === "C")?.text || "",
        D: opts.find(o => o.letter === "D")?.text || ""
      },
      adminAnswer: adminAnswers.join(", ") || "-",
      solutionAnswer: solutionAnswer || "-",
      optionsCount: opts.length,
      videoSolution: videoStatus,
      hasError: false
    };

    function addError(ruleId, check, details) {
      q.hasError = true;
      rows.push(reportRow({
        priority: "Critical",
        type: "Question",
        qno,
        ruleId,
        check,
        status: "ERROR",
        details,
        adminAnswer: q.adminAnswer,
        solutionAnswer: q.solutionAnswer,
        optionsCount: q.optionsCount,
        videoSolution: q.videoSolution
      }));
    }

    function addWarning(ruleId, check, details) {
      rows.push(reportRow({
        priority: "Warning",
        type: "Question",
        qno,
        ruleId,
        check,
        status: "WARNING",
        details,
        adminAnswer: q.adminAnswer,
        solutionAnswer: q.solutionAnswer,
        optionsCount: q.optionsCount,
        videoSolution: q.videoSolution
      }));
    }

    if (!questionText && !contentEl?.querySelector("img")) {
      addError("Q001", "Question", "Question missing");
    }

    if (adminAnswers.length === 0) {
      addError("Q002", "Correct Answer", "Correct answer not marked in green");
    }

    if (adminAnswers.length > 1) {
      addError("Q003", "Correct Answer", `Multiple correct answers marked: ${adminAnswers.join(", ")}`);
    }

    if (adminAnswers.length === 1 && solutionAnswer && adminAnswers[0] !== solutionAnswer) {
      addError("Q004", "Answer Mismatch", `Green marked ${adminAnswers[0]}, Solution says ${solutionAnswer}`);
    }

    if (!hasMeaningfulSolution(contentText)) {
      addError("Q005", "Solution", "Solution/Explanation missing");
    }

    if (opts.length !== 4) {
      addWarning("W001", "Options Count", `Options count is ${opts.length}, expected exactly 4`);
    }

    // Video warning is generated only after Edit Test configuration is read.

    const hasQuestionImage = Boolean(contentEl?.querySelector("img"));

    if (
      questionText.length > 0 &&
      questionText.length < 10 &&
      !hasQuestionImage
    ) {
      addWarning("W004", "Question Text", "Question text too short");
    }

    imageWarnings(contentEl).forEach(msg => addWarning("W006", "Image Quality", msg));

    questions.push(q);
  });

  return { questions, reportRows: rows };
}

function questionUniqueKey(q) {
  const textKey = compactText(q.question)
    .toLowerCase()
    .replace(/^q?\s*\d+[\.)]?\s*/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${q.qno}|${textKey}`.slice(0, 500);
}

function findNextButton(root) {
  const candidates = Array.from(document.querySelectorAll("button,[role='button'],a"))
    .filter(isVisible)
    .map(btn => {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      const title = (btn.getAttribute("title") || "").toLowerCase();
      const text = compactText(btn.innerText || btn.textContent || "").toLowerCase();
      const icon = compactText(btn.querySelector("mat-icon")?.innerText || "").toLowerCase();

      const disabled =
        btn.disabled ||
        btn.getAttribute("disabled") !== null ||
        btn.getAttribute("aria-disabled") === "true" ||
        btn.classList.contains("mat-button-disabled") ||
        btn.classList.contains("mat-mdc-button-disabled") ||
        Boolean(btn.closest(".mat-button-disabled,.mat-mdc-button-disabled"));

      const looksNext =
        label === "next page" ||
        label.includes("next page") ||
        title.includes("next") ||
        text === "next" ||
        icon === "chevron_right" ||
        icon === "keyboard_arrow_right" ||
        icon === "navigate_next";

      if (!looksNext || disabled) return null;

      const rect = btn.getBoundingClientRect();
      const inPreviewDialog = Boolean(
        btn.closest("mat-dialog-container,.mat-mdc-dialog-container,.cdk-overlay-pane,[role='dialog']")?.querySelector("mat-card-title")
      );

      return {
        btn,
        score: (inPreviewDialog ? 10000 : 0) + rect.top + (rect.left > window.innerWidth * 0.45 ? 500 : 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.btn || null;
}


async function scanPreview(options = {}) {
  const firstRoot = getPreviewRoot();

  if (!firstRoot) {
    return {
      questions: [],
      reportRows: [],
      imagesFound: 0,
      previewChecked: false
    };
  }

  const allQuestions = [];
  const rows = [];
  const seenQuestionKeys = new Set();
  const seenPageSignatures = new Set();
  const maxPages = 100;

  for (let page = 1; page <= maxPages; page++) {
    const pageRoot = getPreviewRoot() || firstRoot;

    await autoScrollRoot(pageRoot);

    const current = extractQuestions(pageRoot, options);

    const signature = current.questions
      .map(q => `${q.qno}:${compactText(q.question).slice(0, 120)}`)
      .join("|");

    if (signature && seenPageSignatures.has(signature)) break;
    if (signature) seenPageSignatures.add(signature);

    current.questions.forEach(q => {
      const key = questionUniqueKey(q);

      if (!seenQuestionKeys.has(key)) {
        seenQuestionKeys.add(key);
        allQuestions.push(q);
      }
    });

    rows.push(...current.reportRows);

    const previewDialog =
      pageRoot.closest?.(
        "mat-dialog-container,.mat-mdc-dialog-container,.cdk-overlay-pane,[role='dialog']"
      ) || pageRoot;

    const nextButton = Array.from(
      previewDialog.querySelectorAll(
        "button[aria-label='Next page']"
      )
    )
      .filter(isVisible)
      .find(btn => {
        const disabled =
          btn.disabled ||
          btn.getAttribute("disabled") !== null ||
          btn.getAttribute("aria-disabled") === "true" ||
          btn.classList.contains("mat-button-disabled") ||
          btn.classList.contains("mat-mdc-button-disabled") ||
          Boolean(
            btn.closest(
              ".mat-button-disabled,.mat-mdc-button-disabled"
            )
          );

        return !disabled;
      });

    if (!nextButton) break;

    robustClick(nextButton);

    let pageChanged = false;

    for (let attempt = 0; attempt < 14; attempt++) {
      await sleep(500);

      const afterRoot = getPreviewRoot() || pageRoot;
      const afterCurrent = extractQuestions(afterRoot, options);

      const afterSignature = afterCurrent.questions
        .map(q => `${q.qno}:${compactText(q.question).slice(0, 120)}`)
        .join("|");

      if (afterSignature && afterSignature !== signature) {
        pageChanged = true;
        break;
      }
    }

    if (!pageChanged) break;
  }

  allQuestions.sort((a, b) => Number(a.qno) - Number(b.qno));

  return {
    questions: allQuestions,
    reportRows: rows,
    imagesFound: (getPreviewRoot() || firstRoot)
      .querySelectorAll("img").length,
    previewChecked: true
  };
}

function duplicateRows(questions) {
  return [];
}

function numberFromInput(input) {
  if (!input) return null;

  const raw = String(input.value ?? input.getAttribute("value") ?? "")
    .trim()
    .replace(/,/g, "");

  const n = Number(raw);

  return Number.isFinite(n) ? n : null;
}

function getNumberByLabel(root, labelRegex, excludeRegex) {
  if (!root) return null;

  const candidates = [];

  Array.from(root.querySelectorAll("mat-form-field, .mat-mdc-form-field, .mat-form-field")).forEach(field => {
    const label = compactText(field.innerText || field.textContent || "");

    if (!labelRegex.test(label)) return;
    if (excludeRegex && excludeRegex.test(label)) return;

    const input = field.querySelector("input[type='number'], input[type='text'], input:not([type])");
    const value = numberFromInput(input);

    if (value !== null) {
      candidates.push({ value, label, score: 100 });
    }
  });

  Array.from(root.querySelectorAll("input[type='number']")).forEach(input => {
    const value = numberFromInput(input);
    if (value === null) return;

    let el = input.parentElement;
    let text = "";

    for (let i = 0; i < 8 && el && el !== root.parentElement; i++, el = el.parentElement) {
      text = compactText(el.innerText || el.textContent || "");
      if (labelRegex.test(text)) break;
    }

    if (!labelRegex.test(text)) return;
    if (excludeRegex && excludeRegex.test(text)) return;

    candidates.push({ value, label: text, score: 80 });
  });

  candidates.sort((a, b) => b.score - a.score);

  return candidates[0]?.value ?? null;
}

function checkboxChecked(inputOrHolder) {
  if (!inputOrHolder) return null;

  const input = inputOrHolder.matches?.("input[type='checkbox']")
    ? inputOrHolder
    : inputOrHolder.querySelector?.("input[type='checkbox']");

  const holder =
    input?.closest("mat-checkbox,.mat-checkbox,.mat-mdc-checkbox,label") ||
    inputOrHolder.closest?.("mat-checkbox,.mat-checkbox,.mat-mdc-checkbox,label") ||
    inputOrHolder;

  return Boolean(
    input?.checked === true ||
    input?.getAttribute("aria-checked") === "true" ||
    holder?.getAttribute?.("aria-checked") === "true" ||
    holder?.classList?.contains("mat-checkbox-checked") ||
    holder?.classList?.contains("mat-mdc-checkbox-checked") ||
    holder?.classList?.contains("mdc-checkbox--selected") ||
    holder?.querySelector?.(".mat-checkbox-checked,.mat-mdc-checkbox-checked,.mdc-checkbox--selected")
  );
}

function getCheckboxState(root, labelText) {
  if (!root) return null;

  const target = labelText.toLowerCase();

  const holders = Array.from(root.querySelectorAll("mat-checkbox, .mat-checkbox, .mat-mdc-checkbox, label, input[type='checkbox']"));

  for (const h of holders) {
    const holder = h.matches?.("input[type='checkbox']")
      ? h.closest("label,mat-checkbox,.mat-checkbox,.mat-mdc-checkbox") || h.parentElement || h
      : h;

    const text = compactText(holder.innerText || holder.textContent || "").toLowerCase();
    const aria = compactText(`${h.getAttribute("aria-label") || ""} ${h.getAttribute("name") || ""}`).toLowerCase();

    if (text.includes(target) || aria.includes(target)) {
      return checkboxChecked(h);
    }
  }

  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let node;
  while ((node = walker.nextNode())) {
    const text = compactText(node.nodeValue || "").toLowerCase();

    if (text.includes(target) && node.parentElement && isVisible(node.parentElement)) {
      textNodes.push(node.parentElement);
    }
  }

  for (const labelEl of textNodes) {
    const labelRect = labelEl.getBoundingClientRect();

    const candidates = Array.from(root.querySelectorAll("input[type='checkbox']"))
      .map(input => {
        const holder = input.closest("mat-checkbox,.mat-checkbox,.mat-mdc-checkbox,label") || input.parentElement || input;
        const rect = holder.getBoundingClientRect();
        const dy = Math.abs((rect.top + rect.bottom) / 2 - (labelRect.top + labelRect.bottom) / 2);
        const dx = Math.abs(rect.right - labelRect.left);

        return {
          input,
          dy,
          dx,
          score: dy * 20 + dx,
          rect
        };
      })
      .filter(x => x.rect.left <= labelRect.left + 40 && x.score < 800)
      .sort((a, b) => a.score - b.score);

    if (candidates[0]) return checkboxChecked(candidates[0].input);
  }

  return null;
}

function getValueAfterLabel(text, regex) {
  const lines = cleanText(text)
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      const same = lines[i].replace(regex, "").replace(/[*:]/g, "").trim();
      return same || lines[i + 1] || "";
    }
  }

  return "";
}


function normalizeLocalizedDigits(value = "") {
  const digitRanges = [
    [0x0966, 0x096F], // Devanagari
    [0x09E6, 0x09EF], // Bengali
    [0x0A66, 0x0A6F], // Gurmukhi
    [0x0AE6, 0x0AEF], // Gujarati
    [0x0B66, 0x0B6F], // Odia
    [0x0BE6, 0x0BEF], // Tamil
    [0x0C66, 0x0C6F], // Telugu
    [0x0CE6, 0x0CEF], // Kannada
    [0x0D66, 0x0D6F], // Malayalam
    [0x0660, 0x0669], // Arabic-Indic
    [0x06F0, 0x06F9]  // Extended Arabic-Indic
  ];

  return String(value).replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F]/g, char => {
    const code = char.charCodeAt(0);

    for (const [start, end] of digitRanges) {
      if (code >= start && code <= end) {
        return String(code - start);
      }
    }

    return char;
  });
}

function collectNumbersNearKeywords(text, keywordPattern, maxDistance = 35) {
  const normalized = normalizeLocalizedDigits(text);
  const results = [];
  const numberPattern = /\d+(?:\.\d+)?/g;
  const keywordRegex = new RegExp(keywordPattern, "giu");

  const numbers = [];
  let numberMatch;

  while ((numberMatch = numberPattern.exec(normalized)) !== null) {
    numbers.push({
      value: Number(numberMatch[0]),
      index: numberMatch.index
    });
  }

  let keywordMatch;

  while ((keywordMatch = keywordRegex.exec(normalized)) !== null) {
    const keywordIndex = keywordMatch.index;

    numbers.forEach(item => {
      const distance = Math.abs(item.index - keywordIndex);

      if (
        distance <= maxDistance &&
        Number.isFinite(item.value) &&
        !results.includes(item.value)
      ) {
        results.push(item.value);
      }
    });
  }

  return results;
}

function findDurations(text) {
  const normalized = normalizeLocalizedDigits(text);

  const minuteWords = [
    "minute", "minutes", "min", "mins",
    "मिनट", "मिनटों", "मिनिट", "मिनिट्स",
    "মিনিট", "মিনিটে",
    "ਮਿੰਟ",
    "મિનિટ",
    "ମିନିଟ",
    "நிமிடம்", "நிமிடங்கள்",
    "నిమిషం", "నిమిషాలు",
    "ನಿಮಿಷ", "ನಿಮಿಷಗಳು",
    "മിനിറ്റ്", "മിനിറ്റുകൾ",
    "دقيقة", "دقائق"
  ];

  const hourWords = [
    "hour", "hours", "hr", "hrs",
    "घंटा", "घंटे", "घण्टा", "घण्टे",
    "ঘণ্টা", "ঘন্টা",
    "ਘੰਟਾ", "ਘੰਟੇ",
    "કલાક",
    "ଘଣ୍ଟା",
    "மணி", "மணிநேரம்",
    "గంట", "గంటలు",
    "ಗಂಟೆ", "ಗಂಟೆಗಳು",
    "മണിക്കൂർ", "മണിക്കൂറുകൾ",
    "ساعة", "ساعات"
  ];

  const timeWords = [
    "time", "duration", "given time", "time given", "test time",
    "समय", "अवधि", "दिया गया समय", "समय अवधि",
    "সময়", "সময়কাল",
    "ਸਮਾਂ", "ਅਵਧੀ",
    "સમય", "અવધિ",
    "ସମୟ", "ଅବଧି",
    "நேரம்", "கால அளவு",
    "సమయం", "వ్యవధి",
    "ಸಮಯ", "ಅವಧಿ",
    "സമയം", "ദൈർഘ്യം",
    "وقت", "مدة"
  ];

  const values = [];

  const minutePattern = minuteWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const hourPattern = hourWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const timePattern = timeWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const directMinuteRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(?:${minutePattern})|(?:${minutePattern})\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)`,
    "giu"
  );

  const directHourRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(?:${hourPattern})|(?:${hourPattern})\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)`,
    "giu"
  );

  let match;

  while ((match = directMinuteRegex.exec(normalized)) !== null) {
    const value = Number(match[1] || match[2]);

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 10000 &&
      !values.includes(value)
    ) {
      values.push(value);
    }
  }

  while ((match = directHourRegex.exec(normalized)) !== null) {
    const hours = Number(match[1] || match[2]);
    const minutes = hours * 60;

    if (
      Number.isFinite(minutes) &&
      minutes > 0 &&
      minutes < 10000 &&
      !values.includes(minutes)
    ) {
      values.push(minutes);
    }
  }

  // Fallback for unusual word order:
  // number near a time keyword and near a unit.
  const timeNumbers = collectNumbersNearKeywords(
    normalized,
    timePattern,
    40
  );

  const minuteNumbers = collectNumbersNearKeywords(
    normalized,
    minutePattern,
    25
  );

  const hourNumbers = collectNumbersNearKeywords(
    normalized,
    hourPattern,
    25
  );

  timeNumbers.forEach(value => {
    if (
      minuteNumbers.includes(value) &&
      value > 0 &&
      value < 10000 &&
      !values.includes(value)
    ) {
      values.push(value);
    }

    if (
      hourNumbers.includes(value) &&
      value > 0 &&
      value * 60 < 10000 &&
      !values.includes(value * 60)
    ) {
      values.push(value * 60);
    }
  });

  return values;
}


function findInstructionQuestionCounts(text) {
  const normalized = normalizeLocalizedDigits(text);

  const questionWords = [
    "question", "questions", "ques", "qns",
    "प्रश्न", "प्रश्नों", "सवाल", "सवालों",
    "প্রশ্ন", "প্রশ্নগুলি",
    "ਸਵਾਲ", "ਪ੍ਰਸ਼ਨ",
    "પ્રશ્ન", "સવાલ",
    "ପ୍ରଶ୍ନ",
    "கேள்வி", "கேள்விகள்",
    "ప్రశ్న", "ప్రశ్నలు",
    "ಪ್ರಶ್ನೆ", "ಪ್ರಶ್ನೆಗಳು",
    "ചോദ്യം", "ചോദ്യങ്ങൾ",
    "سوال", "سوالات"
  ];

  const countWords = [
    "total", "contain", "contains", "will contain", "number of",
    "कुल", "होंगे", "रहेंगे", "संख्या",
    "মোট", "থাকবে", "সংখ্যা",
    "ਕੁੱਲ", "ਗਿਣਤੀ",
    "કુલ", "સંખ્યા",
    "ମୋଟ", "ସଂଖ୍ୟା",
    "மொத்த", "எண்ணிக்கை",
    "మొత్తం", "సంఖ్య",
    "ಒಟ್ಟು", "ಸಂಖ್ಯೆ",
    "ആകെ", "എണ്ണം",
    "کل", "تعداد"
  ];

  const questionPattern = questionWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const countPattern = countWords
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const found = [];

  const directRegex = new RegExp(
    `(?:${countPattern})?[^\\d]{0,25}(\\d+)[^\\d]{0,25}(?:${questionPattern})|(?:${questionPattern})[^\\d]{0,25}(\\d+)`,
    "giu"
  );

  let match;

  while ((match = directRegex.exec(normalized)) !== null) {
    const value = Number(match[1] || match[2]);

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 10000 &&
      !found.includes(value)
    ) {
      found.push(value);
    }
  }

  // Fallback for unusual sentence order.
  const nearQuestion = collectNumbersNearKeywords(
    normalized,
    questionPattern,
    35
  );

  nearQuestion.forEach(value => {
    if (
      value > 0 &&
      value < 10000 &&
      !found.includes(value)
    ) {
      found.push(value);
    }
  });

  return found;
}

function findInstructionTotalMarks(text) {
  const found = [];

  const patterns = [
    /total\s+marks?\s*[:\-]?\s*(\d+(?:\.\d+)?)/gi,
    /maximum\s+marks?\s*[:\-]?\s*(\d+(?:\.\d+)?)/gi,
    /(\d+(?:\.\d+)?)\s+marks?\s+(?:in\s+total|total)/gi
  ];

  patterns.forEach(regex => {
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = Number(match[1]);

      if (
        Number.isFinite(value) &&
        value >= 0 &&
        value < 100000 &&
        !found.includes(value)
      ) {
        found.push(value);
      }
    }
  });

  return found;
}

function syllabusStatus(text) {
  const value = getValueAfterLabel(text, /^syllabus\b.*?/i);
  const hasWord = /\bsyllabus\b/i.test(text);
  const missing = !value || /^(none|na|n\/a|null|undefined|-)?$/i.test(value);

  return {
    found: hasWord,
    missing,
    value
  };
}


function robustClick(el) {
  if (!el) return false;
  try {
    el.scrollIntoView({ block: "center", inline: "center" });
  } catch {}

  const rect = el.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };

  ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
    try {
      el.dispatchEvent(new MouseEvent(type, opts));
    } catch {
      try { el.click(); } catch {}
    }
  });

  try { el.click(); } catch {}
  return true;
}

function getTestRowActionButtons() {
  return Array.from(document.querySelectorAll("button,[role='button']"))
    .filter(isVisible)
    .filter(btn => {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      const title = (btn.getAttribute("title") || "").toLowerCase();
      const text = compactText(btn.innerText || btn.textContent || "").toLowerCase();
      const icon = compactText(btn.querySelector("mat-icon")?.innerText || "").toLowerCase();
      const rect = btn.getBoundingClientRect();

      const looksMenu =
        label.includes("more") ||
        title.includes("more") ||
        text === "more_vert" ||
        icon === "more_vert" ||
        icon.includes("more_vert") ||
        text === "⋮";

      return looksMenu && rect.top > 250 && rect.left > window.innerWidth * 0.55;
    })
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}

async function clickFirstRowMenuItem(itemRegex) {
  const menuButtons = getTestRowActionButtons();
  let lastMenuTexts = [];

  for (const btn of menuButtons) {
    robustClick(btn);
    await sleep(1000);

    const overlays = Array.from(document.querySelectorAll(
      ".mat-menu-panel,.mat-mdc-menu-panel,[role='menu'],.cdk-overlay-pane"
    )).filter(isVisible);

    const menuRoot = overlays.pop() || document;

    const menuItems = Array.from(menuRoot.querySelectorAll("button,[role='menuitem'],a,span,div"))
      .filter(isVisible)
      .map(el => {
        const clickable = el.closest("button,[role='menuitem'],a") || el;
        const text = compactText(el.innerText || el.textContent || "");
        return { el, clickable, text };
      })
      .filter(x => x.text && x.text !== "more_vert");

    lastMenuTexts = menuItems.map(x => x.text);

    let item = menuItems.find(x => itemRegex.test(x.text));

    if (!item && /edit/i.test(String(itemRegex))) {
      item = menuItems.find(x => /edit|update|modify/i.test(x.text));
    }

    if (!item && /preview/i.test(String(itemRegex))) {
      item = menuItems.find(x => /preview|view|questions/i.test(x.text));
    }

    if (item) {
      robustClick(item.clickable);
      await sleep(2800);
      return true;
    }

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await sleep(500);
  }

  window.__QC_LAST_MENU_TEXTS__ = lastMenuTexts;
  return false;
}

async function openPreviewTest() {
  if (getPreviewRoot()) return true;

  const directPreview = Array.from(document.querySelectorAll("button,[role='button'],a"))
    .filter(isVisible)
    .find(el => /preview\s*test|preview\s*test\s*&\s*questions|test\s*&\s*questions|view\s*questions/i.test(
      compactText(el.innerText || el.textContent || el.getAttribute("aria-label") || "")
    ));

  if (directPreview) {
    robustClick(directPreview);
    await sleep(3000);
    return Boolean(getPreviewRoot());
  }

  const clicked = await clickFirstRowMenuItem(/preview\s*test|preview\s*test\s*&\s*questions|test\s*&\s*questions|view\s*questions|preview|view/i);

  if (clicked) {
    await sleep(1500);
    return Boolean(getPreviewRoot());
  }

  return Boolean(getPreviewRoot());
}


function clickVisibleButtonByText(textPatterns, root = document) {
  const patterns = textPatterns.map(x => x instanceof RegExp ? x : new RegExp(String(x), "i"));

  const candidates = Array.from(root.querySelectorAll("button,[role='button'],a,mat-icon"))
    .filter(isVisible)
    .map(el => {
      const button = el.closest("button,[role='button'],a") || el;

      const text = compactText([
        button.innerText || "",
        button.getAttribute("aria-label") || "",
        button.getAttribute("title") || "",
        el.innerText || ""
      ].join(" "));

      return { el: button, text };
    })
    .filter(x => patterns.some(pattern => pattern.test(x.text)));

  if (!candidates.length) return false;

  candidates[0].el.click();
  return true;
}

function getPreviewTestTitle() {
  const root = getPreviewRoot();
  if (!root) return "";

  const lines = String(root.innerText || root.textContent || "")
    .split("\n")
    .map(line => compactText(line))
    .filter(Boolean)
    .filter(line => line.toLowerCase() !== "close");

  return lines[0] || "";
}

function normalizeTestTitle(text = "") {
  return compactText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTargetTestActionButton() {
  const rawManualName = compactText(
    window.__QC_MANUAL_TEST_NAME__ || ""
  );

  const rawPreviewName = compactText(
    window.__QC_TARGET_TEST_TITLE__ || ""
  );

  const rawTarget = rawManualName || rawPreviewName;

  if (!rawTarget) {
    window.__QC_EDIT_ERROR__ =
      "Test name not available for exact row matching";
    return null;
  }

  const normalizedFullName = normalizeTestTitle(rawTarget);

  // Preview title may end with template/type, e.g.
  // "Weekly Test (...) (Mock And Regular) - MockAndRegular"
  // while the table NAME cell contains only:
  // "Weekly Test (...) (Mock And Regular)"
  const withoutTrailingSuffix = compactText(
    rawTarget.replace(/\s+-\s+[^-]+$/u, "")
  );

  const normalizedBaseName = normalizeTestTitle(
    withoutTrailingSuffix
  );

  const acceptedNames = new Set(
    [normalizedFullName, normalizedBaseName]
      .filter(Boolean)
  );

  const cells = Array.from(
    document.querySelectorAll(
      "td, mat-cell, .mat-cell, .mat-mdc-cell, [role='cell']"
    )
  ).filter(isVisible);

  const matchingCells = cells.filter(cell => {
    const cellText = normalizeTestTitle(
      cell.innerText || cell.textContent || ""
    );

    return acceptedNames.has(cellText);
  });

  if (matchingCells.length === 0) {
    window.__QC_EDIT_ERROR__ =
      `Exact test name cell not found for: ${rawTarget}`;
    return null;
  }

  for (const cell of matchingCells) {
    const row = cell.closest(
      "tr, mat-row, .mat-row, .mat-mdc-row, [role='row']"
    );

    if (!row) continue;

    const actionButton = Array.from(
      row.querySelectorAll("button,[role='button']")
    ).find(btn => {
      const text = compactText(
        btn.innerText || btn.textContent || ""
      ).toLowerCase();

      const icon = compactText(
        btn.querySelector("mat-icon")?.innerText || ""
      ).toLowerCase();

      return text === "more_vert" || icon === "more_vert";
    });

    if (actionButton) return actionButton;
  }

  window.__QC_EDIT_ERROR__ =
    `Exact test row found, but action button missing for: ${rawTarget}`;

  return null;
}

async function closePreview() {
  window.__QC_TARGET_TEST_TITLE__ = getPreviewTestTitle();

  const closeCandidates = Array.from(document.querySelectorAll(
    "button[aria-label='Close'],button[aria-label='close'],button[mat-dialog-close],.mat-dialog-close,.mat-mdc-dialog-close,button"
  ))
    .filter(isVisible)
    .map(btn => {
      const text = compactText(
        `${btn.innerText || ""} ${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""}`
      ).toLowerCase();

      const icon = compactText(
        btn.querySelector("mat-icon")?.innerText || ""
      ).toLowerCase();

      const inPreviewDialog = Boolean(
        btn.closest(
          "mat-dialog-container,.mat-mdc-dialog-container,.cdk-overlay-pane,[role='dialog']"
        )?.querySelector("mat-card-title")
      );

      let score = 0;
      if (inPreviewDialog) score += 10000;
      if (text === "close" || text.includes("close")) score += 200;
      if (text === "x" || text === "×") score += 100;
      if (icon === "close" || icon === "cancel") score += 200;

      return { btn, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (closeCandidates[0]) {
    robustClick(closeCandidates[0].btn);
    await sleep(1200);

    if (!getPreviewRoot()) return true;
  }

  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true
    })
  );

  await sleep(1200);
  return !getPreviewRoot();
}

function getThreeDotButtons() {
  return Array.from(document.querySelectorAll("button,[role='button']"))
    .filter(isVisible)
    .filter(btn => {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      const title = (btn.getAttribute("title") || "").toLowerCase();
      const text = compactText(btn.innerText || "").toLowerCase();
      const icon = compactText(btn.querySelector("mat-icon")?.innerText || "").toLowerCase();

      return (
        label.includes("more") ||
        title.includes("more") ||
        text === "more_vert" ||
        icon === "more_vert" ||
        icon.includes("more_vert") ||
        text === "⋮"
      );
    });
}

async function openEditTest() {
  if (getPreviewRoot()) {
    await closePreview();
    await sleep(1200);
  }

  const targetButton = getTargetTestActionButton();

  if (!targetButton) {
    window.__QC_LAST_MENU_TEXTS__ = [
      window.__QC_EDIT_ERROR__ || "Exact test row not found"
    ];
    return false;
  }

  try {
    targetButton.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch {}

  await sleep(300);

  try {
    targetButton.focus();
  } catch {}

  robustClick(targetButton);
  await sleep(1200);

  const menuPane = Array.from(
    document.querySelectorAll(
      ".cdk-overlay-pane,.mat-menu-panel,.mat-mdc-menu-panel,[role='menu']"
    )
  )
    .filter(isVisible)
    .find(el => {
      const menuText = compactText(
        el.innerText || el.textContent || ""
      );

      return (
        menuText.includes("Preview Test & Questions") &&
        menuText.includes("Edit Test")
      );
    });

  if (!menuPane) {
    window.__QC_LAST_MENU_TEXTS__ = [
      `Action menu did not open for exact test: ${
        window.__QC_MANUAL_TEST_NAME__ || "-"
      }`
    ];
    return false;
  }

  const editItem = Array.from(
    menuPane.querySelectorAll(
      "button,[role='menuitem'],a"
    )
  )
    .filter(isVisible)
    .find(el => {
      const itemText = compactText(
        el.innerText || el.textContent || ""
      );

      return /^edit\s*test$/i.test(itemText) ||
        /edit\s*test/i.test(itemText);
    });

  if (!editItem) {
    window.__QC_LAST_MENU_TEXTS__ = [
      "Edit Test option not found in the exact test menu"
    ];
    return false;
  }

  robustClick(editItem);
  await sleep(2800);

  const saveNextButton = Array.from(
    document.querySelectorAll(
      "button,[role='button'],a"
    )
  )
    .filter(isVisible)
    .find(el => {
      const buttonText = compactText(
        `${el.innerText || el.textContent || ""} ${
          el.getAttribute("aria-label") || ""
        }`
      );

      return /save\s*&\s*next/i.test(buttonText);
    });

  if (saveNextButton) {
    robustClick(saveNextButton);
    await sleep(2800);
  }

  return Boolean(getEditRoot());
}

function readEditConfig(scannedCount, instructionsText = "", options = {}) {
  const rows = [];
  const root = getEditRoot();

  if (!root) {
    return {
      found: false,
      rows,
      config: {
        allowSubmit: null,
        totalQuestions: null,
        duration: null,
        totalMarks: null,
        syllabus: null,
        videoRequired: false
      }
    };
  }

  const editText = cleanText(root.innerText || root.textContent || "");
  const instructionSource = cleanText(instructionsText || "");

  const totalQuestions = getNumberByLabel(
    root,
    /total\s+questions\s*\*?/i,
    /display\s+order|total\s+marks|duration|available/i
  );

  const duration = getNumberByLabel(
    root,
    /duration\s+in\s+minutes\s*\*?/i,
    /display\s+order|total\s+questions|total\s+marks|available/i
  );

  const totalMarks = getNumberByLabel(
    root,
    /total\s+marks\s*\*?/i,
    /display\s+order|total\s+questions|duration|available/i
  );

  const allowSubmit = getCheckboxState(root, "Allow Submit");

  // Only the popup checkbox decides whether video warnings are required.
  const videoRequired =
    options.hasVideoSolutions === true ||
    options.videoRequired === true;

  const syllabus = syllabusStatus(editText);

  if (allowSubmit === false) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T001",
      check: "Allow Submit",
      status: "ERROR",
      details: "Allow Submit is not checked"
    }));
  } else if (allowSubmit === null) {
    rows.push(reportRow({
      priority: "Warning",
      type: "Test",
      qno: "-",
      ruleId: "T001",
      check: "Allow Submit",
      status: "WARNING",
      details: "Allow Submit checkbox not found"
    }));
  }

  if (totalQuestions === null) {
    rows.push(reportRow({
      priority: "Warning",
      type: "Test",
      qno: "-",
      ruleId: "T002",
      check: "Total Questions",
      status: "WARNING",
      details: "Total Questions field not found"
    }));
  } else if (scannedCount > 0 && totalQuestions !== scannedCount) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T002",
      check: "Total Questions",
      status: "ERROR",
      details: `Total Questions field = ${totalQuestions}, Scanned = ${scannedCount}`
    }));
  }

  if (duration === null) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T003",
      check: "Duration",
      status: "ERROR",
      details: "Duration In Minutes field missing"
    }));
  }

  if (totalMarks === null) {
    rows.push(reportRow({
      priority: "Warning",
      type: "Test",
      qno: "-",
      ruleId: "T008",
      check: "Total Marks",
      status: "WARNING",
      details: "Total Marks field not found"
    }));
  }

  const instructionDurations = findDurations(instructionSource);

  if (instructionDurations.length === 0) {
    rows.push(reportRow({
      priority: "Warning",
      type: "Test",
      qno: "-",
      ruleId: "T004",
      check: "Duration in Instructions",
      status: "WARNING",
      details: "Duration not mentioned in instructions"
    }));
  } else if (
    duration !== null &&
    !instructionDurations.includes(duration)
  ) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T004",
      check: "Duration in Instructions",
      status: "ERROR",
      details: `Duration field = ${duration} min, Instructions = ${instructionDurations.join("/")} min`
    }));
  }

  const instructionQuestionCounts =
    findInstructionQuestionCounts(instructionSource);

  if (
    totalQuestions !== null &&
    instructionQuestionCounts.length > 0 &&
    !instructionQuestionCounts.includes(totalQuestions)
  ) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T009",
      check: "Questions in Instructions",
      status: "ERROR",
      details: `Total Questions field = ${totalQuestions}, Instructions = ${instructionQuestionCounts.join("/")}`
    }));
  }

  const instructionTotalMarks =
    findInstructionTotalMarks(instructionSource);

  if (
    totalMarks !== null &&
    instructionTotalMarks.length > 0 &&
    !instructionTotalMarks.includes(totalMarks)
  ) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T010",
      check: "Total Marks in Instructions",
      status: "ERROR",
      details: `Total Marks field = ${totalMarks}, Instructions = ${instructionTotalMarks.join("/")}`
    }));
  }

  if (!syllabus.found || syllabus.missing) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T005",
      check: "Syllabus",
      status: "ERROR",
      details: "Syllabus missing"
    }));
  }

  [
    "Important",
    "Disable Solution",
    "Disable Text Solution",
    "Disable Video Solution",
    "Enable Question Paper",
    "Shuffle Question",
    "Section Timing Enable",
    "Enable StateRank",
    "Is Pausable",
    "Enable Scientific Calculator",
    "Enable Basic Calculator",
    "Enable CAT Percentile",
    "Is Proctored",
    "Enable Percentile",
    "Wallet Purchase",
    "Show all Comprehension Questions together"
  ].forEach(label => {
    if (getCheckboxState(root, label) === true) {
      rows.push(reportRow({
        priority: "Warning",
        type: "Test",
        qno: "-",
        ruleId: "W003",
        check: "Checkbox",
        status: "WARNING",
        details: `${label} is checked`
      }));
    }
  });

  return {
    found: true,
    rows,
    config: {
      allowSubmit,
      totalQuestions,
      duration,
      totalMarks,
      syllabus: syllabus.value || null,
      videoRequired
    }
  };
}

async function closeEditTest() {
  const root = getEditRoot();
  if (!root) return true;

  const closeSelectors = [
    "button[aria-label='Close']",
    "button[aria-label='close']",
    "button[mat-dialog-close]",
    ".mat-dialog-close",
    ".mat-mdc-dialog-close"
  ];

  for (const selector of closeSelectors) {
    const button = Array.from(root.querySelectorAll(selector)).find(isVisible);

    if (button) {
      button.click();
      await sleep(1000);
      return !getEditRoot();
    }
  }

  if (clickVisibleButtonByText([/^close$/i, /^cancel$/i, /^back$/i], root)) {
    await sleep(1000);
    return !getEditRoot();
  }

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  await sleep(1000);

  return !getEditRoot();
}

function buildCSV(rows) {
  sortReportRows(rows);

  let csv = "Priority,Type,Question No,Rule ID,Check,Status,Details,Admin Answer,Solution Answer,Options Count,Video Solution\n";

  rows.forEach(r => {
    csv += [
      r.priority,
      r.type,
      r.qno,
      r.ruleId,
      r.check,
      r.status,
      r.details,
      r.adminAnswer,
      r.solutionAnswer,
      r.optionsCount,
      r.videoSolution
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") + "\n";
  });

  return csv;
}

function getRequestEmail(options = {}) {
  return (
    options.qcUserEmail ||
    options.userEmail ||
    options.email ||
    ""
  );
}

async function runDev3Flow(options = {}) {
  const rows = [];
  const email = getRequestEmail(options);

  window.__QC_MANUAL_TEST_NAME__ = compactText(
    options.manualTestName || options.testName || ""
  );

  if (!isPwLiveEmail(email)) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "AUTH001",
      check: "Email Validation",
      status: "ERROR",
      details: "Only @pw.live email is allowed"
    }));

    return {
      questions: [],
      rows,
      imagesFound: 0,
      config: {}
    };
  }

  let previewOpened = Boolean(getPreviewRoot());

  if (!previewOpened) {
    previewOpened = await openPreviewTest();
  }

  if (!previewOpened) {
    rows.push(reportRow({
      priority: "Critical",
      type: "Test",
      qno: "-",
      ruleId: "T000",
      check: "Preview Test",
      status: "ERROR",
      details: "Preview Test & Questions could not be opened automatically"
    }));

    return {
      questions: [],
      rows,
      imagesFound: 0,
      config: {}
    };
  }

  const preview = await scanPreview({ ...options, videoRequired: false });
  rows.push(...preview.reportRows);

  await closePreview();

  const editOpened = await openEditTest();
  let config = {
    allowSubmit: null,
    totalQuestions: null,
    duration: null,
    syllabus: null,
    videoRequired: false
  };

  if (editOpened) {
    const edit = readEditConfig(preview.questions.length, preview.instructionsText, options);
    config = edit.config;
    rows.push(...edit.rows);
    await closeEditTest();
  } else {
    rows.push(reportRow({
      priority: "Warning",
      type: "Test",
      qno: "-",
      ruleId: "T006",
      check: "Edit Test",
      status: "WARNING",
      details: `Edit Test could not be opened automatically. Menu seen: ${(window.__QC_LAST_MENU_TEXTS__ || []).join(" | ") || "No menu text detected"}`
    }));
  }

  if (config.videoRequired === true) {
    preview.questions.forEach(q => {
      if (q.videoSolution === "Missing") {
        rows.push(reportRow({
          priority: "Warning",
          type: "Question",
          qno: q.qno,
          ruleId: "W002",
          check: "Video Solution",
          status: "WARNING",
          details: "Video solution missing while video checkbox is ON",
          adminAnswer: q.adminAnswer,
          solutionAnswer: q.solutionAnswer,
          optionsCount: q.optionsCount,
          videoSolution: q.videoSolution
        }));
      }
    });
  }

  rows.push(...duplicateRows(preview.questions));
  sortReportRows(rows);

  return {
    questions: preview.questions,
    rows,
    imagesFound: preview.imagesFound,
    config
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.action !== "RUN_QC" &&
    request.action !== "RUN_QC_V2" &&
    request.action !== "RUN_QC_DEV3"
  ) {
    return;
  }

  (async () => {
    try {
      const options = request.options || {};
      const result = await runDev3Flow(options);
      const rows = result.rows;

      const questionErrorSet = new Set(
        rows
          .filter(r => r.type === "Question" && r.status === "ERROR")
          .map(r => String(r.qno))
      );

      const errorCount = rows.filter(r => r.status === "ERROR").length;
      const warningCount = rows.filter(r => r.status === "WARNING").length;

      sendResponse({
        version: QC_VERSION,
        questionsFound: result.questions.length,
        questionsWithErrors: questionErrorSet.size,
        errorCount,
        warningCount,
        passCount: Math.max(0, result.questions.length - questionErrorSet.size),
        imagesFound: result.imagesFound,
        reportRows: rows,
        csv: buildCSV(rows),
        questions: result.questions,
        issues: rows.filter(r => r.status === "ERROR"),
        warnings: rows.filter(r => r.status === "WARNING"),
        config: result.config || {}
      });
    } catch (err) {
      console.error("QC Assistant DEV3 failed", err);

      const rows = [
        reportRow({
          priority: "Critical",
          type: "Test",
          qno: "-",
          ruleId: "RUNTIME",
          check: "Runtime Error",
          status: "ERROR",
          details: err.message || String(err)
        })
      ];

      sendResponse({
        version: QC_VERSION,
        questionsFound: 0,
        questionsWithErrors: 0,
        errorCount: 1,
        warningCount: 0,
        passCount: 0,
        imagesFound: 0,
        reportRows: rows,
        csv: buildCSV(rows),
        questions: [],
        issues: rows,
        warnings: [],
        config: {}
      });
    }
  })();

  return true;
});
