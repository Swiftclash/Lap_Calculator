// Renderer must NOT use require(). Only window.api.* is allowed.

const el = {
  circuitSelect: document.getElementById("circuitSelect"),
  groupSelect: document.getElementById("groupSelect"),
  circuitImg: document.getElementById("circuitImg"),
  imgPlaceholder: document.getElementById("imgPlaceholder"),
  circuitNote: document.getElementById("circuitNote"),
  bestRecordsBody: document.getElementById("bestRecordsBody"),
  paceBody: document.getElementById("paceBody"),
  summaryBody: document.getElementById("summaryBody"),
  paceScroll: document.getElementById("paceScroll"),
  dateText: document.getElementById("dateText"),
  timeText: document.getElementById("timeText"),
  weatherInput: document.getElementById("weatherInput"),
  finishBtn: document.getElementById("finishBtn")
};

const state = {
  circuit: null,
  group: null,
  worldRecord: null,
  laps: [] // [{ lap_ms, s1_ms, s2_ms, s3_ms, lap_locked, s1_locked, s2_locked, s3_locked }]
};

const MAX_VISIBLE_ROWS = 7;
const MIN_LAP_ROWS = 7;
const TIME_DIGITS = 7; // mmssmmm -> 2/2/3 digits
let estimatedRowHeight = 44;

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function localParseMs(input) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  if (/^\d{7}$/.test(s)) {
    const mm = Number(s.slice(0, 2));
    const sec = Number(s.slice(2, 4));
    const ms = Number(s.slice(4, 7));
    return (mm * 60 + sec) * 1000 + ms;
  }

  if (/^\d+:\d{1,2}:\d{1,3}$/.test(s)) {
    const [mPart, secPart, msPart] = s.split(":");
    const m = Number(mPart);
    const sec = Number(secPart);
    const ms = Number(msPart.padEnd(3, "0").slice(0, 3));
    return (m * 60 + sec) * 1000 + ms;
  }

  return null;
}

function localFmtMs(ms) {
  if (!Number.isFinite(ms)) return "";
  const neg = ms < 0;
  let x = Math.abs(Math.trunc(ms));
  const totalSec = Math.floor(x / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mmm = x % 1000;
  const out = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(mmm).padStart(3, "0")}`;
  return neg ? `-${out}` : out;
}

function fmt(ms) {
  if (window.api && typeof window.api.fmtMs === "function") {
    return window.api.fmtMs(ms);
  }
  return localFmtMs(ms);
}

function parse(s) {
  if (window.api && typeof window.api.parseMs === "function") {
    return window.api.parseMs(s);
  }
  return localParseMs(s);
}

function minOrNull(nums) {
  const filtered = nums.filter((n) => Number.isFinite(n));
  if (filtered.length === 0) return null;
  return Math.min(...filtered);
}

function avgOrNull(nums) {
  const filtered = nums.filter((n) => Number.isFinite(n));
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((a, b) => a + b, 0);
  return Math.round(sum / filtered.length);
}

function computeFastLap(laps) {
  const valid = laps.filter((r) => Number.isFinite(r.lap_ms));
  if (!valid.length) return null;
  return valid.reduce((a, b) => (b.lap_ms < a.lap_ms ? b : a));
}

function computeSumOfBest(laps) {
  const s1 = minOrNull(laps.map((r) => r.s1_ms));
  const s2 = minOrNull(laps.map((r) => r.s2_ms));
  const s3 = minOrNull(laps.map((r) => r.s3_ms));
  if (s1 == null || s2 == null || s3 == null) return null;
  return { lap_ms: s1 + s2 + s3, s1_ms: s1, s2_ms: s2, s3_ms: s3 };
}

function computeMinsForHighlight(laps) {
  return {
    lap_ms: minOrNull(laps.map((r) => r.lap_ms)),
    s1_ms: minOrNull(laps.map((r) => r.s1_ms)),
    s2_ms: minOrNull(laps.map((r) => r.s2_ms)),
    s3_ms: minOrNull(laps.map((r) => r.s3_ms))
  };
}

function setCircuitImage(p) {
  if (p && String(p).trim()) {
    const src = p.startsWith("file://") ? p : `file://${p}`;
    el.circuitImg.src = src;
    el.circuitImg.style.display = "block";
    el.imgPlaceholder.style.display = "none";
  } else {
    el.circuitImg.removeAttribute("src");
    el.circuitImg.style.display = "none";
    el.imgPlaceholder.style.display = "flex";
  }
}

function buildBestRecords(records) {
  clearNode(el.bestRecordsBody);

  for (let i = 0; i < 10; i++) {
    const r = records[i];
    const tr = document.createElement("tr");

    const td0 = document.createElement("td");
    td0.textContent = String(i + 1);

    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    const td3 = document.createElement("td");

    if (r) {
      td1.textContent = r.record_date || "";
      td2.textContent = Number.isFinite(r.lap_time_ms) ? fmt(r.lap_time_ms) : "";
      td3.textContent = r.car || "";
    } else {
      td1.textContent = "";
      td2.textContent = "";
      td3.textContent = "";
    }

    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    el.bestRecordsBody.appendChild(tr);
  }
}

async function refreshCircuitSelect() {
  if (!window.api || typeof window.api.listCircuits !== "function") {
    throw new Error("window.api.listCircuits is unavailable (preload not connected)");
  }

  const circuits = await window.api.listCircuits();
  el.circuitSelect.innerHTML = "";
  for (const c of circuits) {
    const opt = document.createElement("option");
    opt.value = c.circuit_name;
    opt.textContent = c.circuit_name;
    el.circuitSelect.appendChild(opt);
  }
  state.circuit = el.circuitSelect.value || null;
  if (state.circuit) {
    await onCircuitChange();
  }
}

function makeLapRow() {
  return {
    lap_ms: null,
    s1_ms: null,
    s2_ms: null,
    s3_ms: null,
    lap_locked: false,
    s1_locked: false,
    s2_locked: false,
    s3_locked: false
  };
}

function ensureAtLeastOneLapRow() {
  if (state.laps.length === 0) {
    state.laps.push(makeLapRow());
  }
}

function getVisibleLapRows() {
  return MAX_VISIBLE_ROWS;
}

function isRowEmpty(r) {
  return (
    !Number.isFinite(r.lap_ms) &&
    !Number.isFinite(r.s1_ms) &&
    !Number.isFinite(r.s2_ms) &&
    !Number.isFinite(r.s3_ms)
  );
}

function ensureSingleTrailingBlankRow() {
  ensureAtLeastOneLapRow();
  const targetRows = getVisibleLapRows();
  const finishedCount = state.laps.filter((r) => Number.isFinite(r.lap_ms)).length;
  const minRows = Math.max(targetRows, finishedCount + 1);

  while (
    state.laps.length >= 2 &&
    isRowEmpty(state.laps[state.laps.length - 1]) &&
    isRowEmpty(state.laps[state.laps.length - 2]) &&
    state.laps.length > minRows
  ) {
    state.laps.pop();
  }

  while (state.laps.length < minRows) {
    state.laps.push(makeLapRow());
  }

  const last = state.laps[state.laps.length - 1];
  if (Number.isFinite(last.lap_ms)) {
    state.laps.push(makeLapRow());
  }
}

function sanitizeTimeInput(text) {
  let out = String(text || "");
  out = out.replace(/[^0-9\s]/g, "");
  out = out.replace(/\s+/g, " ");
  return out.trimStart();
}

function digitsToTimeText(digits) {
  if (digits.length !== TIME_DIGITS) return "";
  const mm = digits.slice(0, 2);
  const ss = digits.slice(2, 4);
  const ms = digits.slice(4, 7);
  return `${mm}:${ss}:${ms}`;
}

function normalizeDigits(digits) {
  const raw = String(digits || "").replace(/\D/g, "");
  if (!raw || raw.length > TIME_DIGITS) return { valid: false, padded: "" };

  let padded = "";
  if (raw.length <= 2) {
    const mm = raw.padStart(2, "0");
    padded = `${mm}00000`;
  } else if (raw.length === 3) {
    const mm = raw.slice(0, 2);
    const ss = `0${raw.slice(2, 3)}`;
    padded = `${mm}${ss}000`;
  } else if (raw.length === 4) {
    const mm = raw.slice(0, 2);
    const ss = raw.slice(2, 4);
    padded = `${mm}${ss}000`;
  } else {
    padded = raw.padEnd(7, "0").slice(0, 7);
  }

  const mmVal = Number(padded.slice(0, 2));
  const ssVal = Number(padded.slice(2, 4));
  const valid = Number.isFinite(mmVal) && Number.isFinite(ssVal) && mmVal <= 60 && ssVal <= 60;
  return { valid, padded };
}

function normalizeTimeText(text) {
  const cleaned = sanitizeTimeInput(text);
  if (!cleaned) return "";

  const digits = cleaned.replace(/\s/g, "");
  const { valid, padded } = normalizeDigits(digits);
  if (valid) return digitsToTimeText(padded);
  return "";
}

function attachInputBehavior(input, onCommit, disabled = false, meta = {}) {
  if (input.dataset.bound === "true") return;
  input.dataset.bound = "true";

  input.className = "cellInput";
  input.placeholder = "00:00:000";
  input.inputMode = "numeric";
  input.maxLength = TIME_DIGITS + 2;
  input.disabled = disabled;
  if (disabled) input.classList.add("cellLocked");
  if (meta.rowIdx != null) input.dataset.row = String(meta.rowIdx);
  if (meta.colKey) input.dataset.col = meta.colKey;

  let lastValue = input.value || "";

  input.addEventListener("focus", () => {
    if (input.value.includes(":")) {
      input.value = input.value.replace(/:/g, "");
    }
    lastValue = input.value;
  });

  input.addEventListener("input", () => {
    const cleaned = sanitizeTimeInput(input.value);
    const digits = cleaned.replace(/\s/g, "");
    if (digits.length > TIME_DIGITS) {
      input.value = lastValue;
      return;
    }
    const normalized = normalizeDigits(digits);
    if (digits.length > 0 && !normalized.valid) {
      input.value = lastValue;
      return;
    }
    input.value = cleaned;
    lastValue = input.value;
  });

  input.addEventListener("keydown", (e) => {
    const key = e.key || "";
    const rowIdx = Number(input.dataset.row);
    const colKey = input.dataset.col || "";

    if (key === "Tab") {
      e.preventDefault();
      if (!Number.isFinite(rowIdx)) return;
      if (!state.laps[rowIdx] || !Number.isFinite(state.laps[rowIdx].lap_ms)) return;
      state.nextFocus = { rowIdx: rowIdx + 1, colKey };
      rebuildPaceTable();
      return;
    }

    if (key !== "Enter" && e.keyCode !== 13) return;
    if (e.isComposing) return;
    const digits = sanitizeTimeInput(input.value).replace(/\s/g, "");
    const normalized = normalizeDigits(digits);
    if (!normalized.valid) return;
    input.value = digitsToTimeText(normalized.padded);
    input.readOnly = true;
    input.disabled = true;
    input.classList.add("cellLocked");
    if (Number.isFinite(rowIdx)) {
      if (colKey === "s1") state.nextFocus = { rowIdx, colKey: "s2" };
      else if (colKey === "s2") state.nextFocus = { rowIdx, colKey: "s3" };
      else if (colKey === "lap") state.nextFocus = { rowIdx: rowIdx + 1, colKey: "s1" };
    }
    onCommit(normalized);
  });
}

function createInputCell(valueText, onCommit, disabled = false, meta = {}) {
  const input = document.createElement("input");
  input.value = valueText || "";
  attachInputBehavior(input, onCommit, disabled, meta);
  return input;
}

function rebuildPaceTable() {
  ensureSingleTrailingBlankRow();
  clearNode(el.paceBody);
  if (el.summaryBody) clearNode(el.summaryBody);

  const lapRows = state.laps.map((r, idx) => ({ ...r, idx }));
  const nonEmptyLapRows = lapRows.filter((r) => !isRowEmpty(r));
  const mins = computeMinsForHighlight(nonEmptyLapRows);

  const fast = computeFastLap(lapRows);
  const sob = computeSumOfBest(lapRows);
  const avg = avgOrNull(lapRows.map((r) => r.lap_ms));
  const avgS1 = avgOrNull(lapRows.map((r) => r.s1_ms));
  const avgS2 = avgOrNull(lapRows.map((r) => r.s2_ms));
  const avgS3 = avgOrNull(lapRows.map((r) => r.s3_ms));
  const fastMs = fast ? fast.lap_ms : null;
  const firstIncompleteIdx = lapRows.findIndex((r) => !Number.isFinite(r.lap_ms));
  const editableIdx = firstIncompleteIdx === -1 ? lapRows.length - 1 : firstIncompleteIdx;
  const finishedCount = lapRows.filter((r) => Number.isFinite(r.lap_ms)).length;

  function maybePurple(td, value, minValue) {
    if (Number.isFinite(value) && Number.isFinite(minValue) && value === minValue) {
      td.classList.add("purpleMin");
    }
  }

  // lap entry rows
  for (const row of lapRows) {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.className = "lapLabel";
    tdLabel.textContent = `Lap${row.idx + 1}`;
    tr.appendChild(tdLabel);

    const isLocked = row.idx > editableIdx;

    const tdLap = document.createElement("td");
    const lapInput = createInputCell(
      fmt(row.lap_ms),
      (val) => {
      const s1 = state.laps[row.idx].s1_ms;
      const s2 = state.laps[row.idx].s2_ms;
      const s3 = state.laps[row.idx].s3_ms;
      const all = Number.isFinite(s1) && Number.isFinite(s2) && Number.isFinite(s3);
      const parsed = val ? parse(digitsToTimeText(val.padded || "")) : null;
      if (all) {
        state.laps[row.idx].lap_ms = s1 + s2 + s3;
      } else {
        state.laps[row.idx].lap_ms = Number.isFinite(parsed) ? parsed : null;
      }
      state.laps[row.idx].lap_locked = Number.isFinite(state.laps[row.idx].lap_ms);
      rebuildPaceTable();
      },
      isLocked || row.lap_locked,
      { rowIdx: row.idx, colKey: "lap" }
    );
    tdLap.appendChild(lapInput);
    maybePurple(tdLap, row.lap_ms, mins.lap_ms);
    tr.appendChild(tdLap);

    function sectorCell(key, minValue, lockKey, colKey) {
      const td = document.createElement("td");
      const input = createInputCell(
        fmt(row[key]),
        (val) => {
          const parsed = val ? parse(digitsToTimeText(val.padded || "")) : null;
          state.laps[row.idx][key] = Number.isFinite(parsed) ? parsed : null;
          state.laps[row.idx][lockKey] = Number.isFinite(state.laps[row.idx][key]);

        // If all sectors exist, lap_speed equals sector1+sector2+sector3.
        const s1 = state.laps[row.idx].s1_ms;
        const s2 = state.laps[row.idx].s2_ms;
        const s3 = state.laps[row.idx].s3_ms;
        const all = Number.isFinite(s1) && Number.isFinite(s2) && Number.isFinite(s3);

        if (all) {
          state.laps[row.idx].lap_ms = s1 + s2 + s3;
          state.laps[row.idx].lap_locked = true;
        }

        if (colKey === "s3") {
          if (all) {
            state.nextFocus = { rowIdx: row.idx + 1, colKey: "s1" };
          } else {
            state.nextFocus = { rowIdx: row.idx, colKey: "lap" };
          }
        }

        rebuildPaceTable();
        },
        isLocked || row[lockKey],
        { rowIdx: row.idx, colKey }
      );
      td.appendChild(input);
      maybePurple(td, row[key], minValue);
      return td;
    }

    tr.appendChild(sectorCell("s1_ms", mins.s1_ms, "s1_locked", "s1"));
    tr.appendChild(sectorCell("s2_ms", mins.s2_ms, "s2_locked", "s2"));
    tr.appendChild(sectorCell("s3_ms", mins.s3_ms, "s3_locked", "s3"));

    const tdGap = document.createElement("td");
    if (Number.isFinite(row.lap_ms) && Number.isFinite(fastMs)) {
      tdGap.textContent = fmt(row.lap_ms - fastMs);
    } else {
      tdGap.textContent = "";
    }
    tr.appendChild(tdGap);

    el.paceBody.appendChild(tr);
  }

  const firstRow = el.paceBody.querySelector("tr");
  if (firstRow) {
    const h = firstRow.getBoundingClientRect().height;
    if (Number.isFinite(h) && h > 0) estimatedRowHeight = h;
  }
  if (el.paceScroll) {
    el.paceScroll.style.maxHeight = `${MAX_VISIBLE_ROWS * estimatedRowHeight}px`;
    if (finishedCount >= MAX_VISIBLE_ROWS) {
      el.paceScroll.scrollTop = el.paceScroll.scrollHeight;
    }
  }

  if (state.nextFocus) {
    const { rowIdx, colKey } = state.nextFocus;
    state.nextFocus = null;
    const selector = `#paceBody input[data-row="${rowIdx}"][data-col="${colKey}"]`;
    const target = document.querySelector(selector);
    if (target && !target.disabled) target.focus();
  } else {
    const active = document.activeElement;
    if (!active || !el.paceBody.contains(active)) {
      const first = document.querySelector('#paceBody input[data-row="0"][data-col="s1"]');
      if (first && !first.disabled) first.focus();
    }
  }

  function addSummaryRow(label, values, gapOverride = "") {
    const tr = document.createElement("tr");
    tr.className = "summaryRow";

    const td0 = document.createElement("td");
    td0.textContent = label;

    const td1 = document.createElement("td");
    td1.textContent = Number.isFinite(values.lap_ms) ? fmt(values.lap_ms) : "";

    const td2 = document.createElement("td");
    td2.textContent = Number.isFinite(values.s1_ms) ? fmt(values.s1_ms) : "";

    const td3 = document.createElement("td");
    td3.textContent = Number.isFinite(values.s2_ms) ? fmt(values.s2_ms) : "";

    const td4 = document.createElement("td");
    td4.textContent = Number.isFinite(values.s3_ms) ? fmt(values.s3_ms) : "";

    const td5 = document.createElement("td");
    td5.textContent = gapOverride || "";

    tr.appendChild(td0);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    (el.summaryBody || el.paceBody).appendChild(tr);
  }

  // Fastest_Lap
  addSummaryRow("Fastest_Lap", {
    lap_ms: fast ? fast.lap_ms : null,
    s1_ms: fast ? fast.s1_ms : null,
    s2_ms: fast ? fast.s2_ms : null,
    s3_ms: fast ? fast.s3_ms : null
  });

  // Sum of Best
  if (sob) {
    addSummaryRow("Sum of Best", sob);
  } else {
    addSummaryRow("Sum of Best", {
      lap_ms: fast ? fast.lap_ms : null,
      s1_ms: fast ? fast.s1_ms : null,
      s2_ms: fast ? fast.s2_ms : null,
      s3_ms: fast ? fast.s3_ms : null
    });
  }

  // Average
  addSummaryRow("Average", { lap_ms: avg, s1_ms: avgS1, s2_ms: avgS2, s3_ms: avgS3 });

  // World record
  const wr = state.worldRecord;
  addSummaryRow("World Record", {
    lap_ms: wr ? wr.lap_time_ms : null,
    s1_ms: wr ? wr.sector1_ms : null,
    s2_ms: wr ? wr.sector2_ms : null,
    s3_ms: wr ? wr.sector3_ms : null
  });

  // No summary Gap row (Gap is per-lap latest only)
}

function updateClock() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  el.dateText.textContent = `${yyyy}-${mm}-${dd}`;

  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  el.timeText.textContent = `${hh}:${mi}:${ss}`;
}

function buildCurrentPaceMarkdown() {
  const lapRows = state.laps.map((r, idx) => ({ ...r, idx }));
  const fast = computeFastLap(lapRows);
  const sob = computeSumOfBest(lapRows);
  const avg = avgOrNull(lapRows.map((r) => r.lap_ms));
  const fastMs = fast ? fast.lap_ms : null;
  const wr = state.worldRecord;

  const lines = [];
  lines.push("# Current_Pace");
  lines.push(`- Circuit: ${state.circuit || ""}`);
  lines.push(`- Competition_group: ${state.group || ""}`);
  lines.push(`- Date: ${el.dateText.textContent || ""}`);
  lines.push(`- Time: ${el.timeText.textContent || ""}`);
  lines.push(`- Weather: ${el.weatherInput.value || ""}`);
  lines.push("");
  lines.push("| Lap | Lap_speed | Sector1 | Sector2 | Sector3 | Gap |");
  lines.push("| --- | --- | --- | --- | --- | --- |");

  for (const row of lapRows) {
    const gap = Number.isFinite(row.lap_ms) && Number.isFinite(fastMs) ? fmt(row.lap_ms - fastMs) : "";
    lines.push(
      `| Lap${row.idx + 1} | ${fmt(row.lap_ms) || ""} | ${fmt(row.s1_ms) || ""} | ${fmt(row.s2_ms) || ""} | ${fmt(row.s3_ms) || ""} | ${gap} |`
    );
  }

  const summaryRows = [
    {
      label: "Fastest_Lap",
      values: {
        lap_ms: fast ? fast.lap_ms : null,
        s1_ms: fast ? fast.s1_ms : null,
        s2_ms: fast ? fast.s2_ms : null,
        s3_ms: fast ? fast.s3_ms : null
      }
    },
    {
      label: "Sum of Best",
      values: sob || {
        lap_ms: fast ? fast.lap_ms : null,
        s1_ms: fast ? fast.s1_ms : null,
        s2_ms: fast ? fast.s2_ms : null,
        s3_ms: fast ? fast.s3_ms : null
      }
    },
    { label: "Average", values: { lap_ms: avg, s1_ms: null, s2_ms: null, s3_ms: null } },
    {
      label: "World Record",
      values: {
        lap_ms: wr ? wr.lap_time_ms : null,
        s1_ms: wr ? wr.sector1_ms : null,
        s2_ms: wr ? wr.sector2_ms : null,
        s3_ms: wr ? wr.sector3_ms : null
      }
    }
  ];

  for (const row of summaryRows) {
    lines.push(
      `| ${row.label} | ${fmt(row.values.lap_ms) || ""} | ${fmt(row.values.s1_ms) || ""} | ${fmt(row.values.s2_ms) || ""} | ${fmt(row.values.s3_ms) || ""} |  |`
    );
  }

  return lines.join("\n");
}

async function refreshWorldRecordAndBest() {
  if (!state.circuit || !state.group) return;
  state.worldRecord = await window.api.getWorldRecord(state.circuit, state.group);
  const records = await window.api.listBestRecords(state.circuit, state.group, 10);
  buildBestRecords(records);
  rebuildPaceTable();
}

async function onCircuitChange() {
  state.circuit = el.circuitSelect.value;

  const circuit = await window.api.getCircuit(state.circuit);
  setCircuitImage(circuit?.picture_path || "");
  el.circuitNote.textContent = circuit?.note || "";

  const groups = await window.api.listGroupsForCircuit(state.circuit);
  el.groupSelect.innerHTML = "";
  for (const g of groups) {
    const opt = document.createElement("option");
    opt.value = g.group_name;
    opt.textContent = g.group_name;
    el.groupSelect.appendChild(opt);
  }

  state.group = el.groupSelect.value || null;

  state.laps = [makeLapRow()];
  await refreshWorldRecordAndBest();
}

async function onGroupChange() {
  state.group = el.groupSelect.value || null;
  state.laps = [makeLapRow()];
  await refreshWorldRecordAndBest();
}

async function onFinish() {
  if (!state.circuit || !state.group) return;

  const fast = computeFastLap(state.laps.map((r, idx) => ({ ...r, idx })));
  if (!fast || !Number.isFinite(fast.lap_ms)) {
    alert("No valid Fastest_Lap found. Please enter lap_speed.");
    return;
  }

  const markdown = buildCurrentPaceMarkdown();
  if (window.api && typeof window.api.saveCurrentPaceMarkdown === "function") {
    await window.api.saveCurrentPaceMarkdown({
      circuitName: state.circuit,
      groupName: state.group,
      markdown
    });
  }

  await window.api.insertBestRecord({
    circuit_name: state.circuit,
    group_name: state.group,
    record_date: el.dateText.textContent,
    record_time: el.timeText.textContent,
    weather: el.weatherInput.value || "",
    car: "",
    lap_time_ms: fast.lap_ms
  });

  state.laps = [makeLapRow()];
  await refreshWorldRecordAndBest();
}

async function init() {
  updateClock();
  setInterval(updateClock, 1000);
  rebuildPaceTable();

  el.circuitSelect.addEventListener("change", onCircuitChange);
  el.groupSelect.addEventListener("change", onGroupChange);
  el.finishBtn.addEventListener("click", onFinish);
  window.addEventListener("resize", () => rebuildPaceTable());

  try {
    const dataDir = window.api && typeof window.api.getDataDir === "function"
      ? await window.api.getDataDir()
      : "(unknown)";
    console.log("[LapDash] dataDir:", dataDir);
    await refreshCircuitSelect();
  } catch (err) {
    console.error("[LapDash] init failed:", err);
    alert(`Database load failed.\n${err.message || err}`);
  }
}

init();
