/**
 * parseMs supports:
 * - "mm:ss:mmm" (preferred)
 * - "m:ss.mmm"  (legacy)
 * - "84.567"    (ss.mmm)
 * - "1 24 567"  (m ss mmm)
 * Returns integer milliseconds or null.
 */
function parseMs(input) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  // normalize commas to dots (optional)
  s = s.replace(/,/g, ".");

  // format: mmssmmm (digits only)
  if (/^\d{7}$/.test(s)) {
    const mm = Number(s.slice(0, 2));
    const sec = Number(s.slice(2, 4));
    const ms = Number(s.slice(4, 7));
    if (!Number.isFinite(mm) || !Number.isFinite(sec) || !Number.isFinite(ms)) return null;
    return (mm * 60 + sec) * 1000 + ms;
  }

  // format: m ss mmm (space-separated)
  // examples: "1 24 567", "0 59 123"
  if (/^\d+\s+\d{1,2}\s+\d{1,3}$/.test(s)) {
    const [mStr, secStr, msStr] = s.split(/\s+/);
    const m = Number(mStr);
    const sec = Number(secStr);
    const ms = Number(msStr.padEnd(3, "0").slice(0, 3));
    if (!Number.isFinite(m) || !Number.isFinite(sec) || !Number.isFinite(ms)) return null;
    return (m * 60 + sec) * 1000 + ms;
  }

  // format: mm:ss:mmm (preferred)
  if (/^\d+:\d{1,2}:\d{1,3}$/.test(s)) {
    const [mPart, secPart, msPart] = s.split(":");
    const m = Number(mPart);
    const sec = Number(secPart);
    const ms = Number(msPart.padEnd(3, "0").slice(0, 3));
    if (!Number.isFinite(m) || !Number.isFinite(sec) || !Number.isFinite(ms)) return null;
    return (m * 60 + sec) * 1000 + ms;
  }

  // format: m:ss(.mmm) legacy
  if (/^\d+:\d{1,2}(\.\d{1,3})?$/.test(s)) {
    const [mPart, secPart] = s.split(":");
    const m = Number(mPart);
    const [secStr, msStr = "0"] = secPart.split(".");
    const sec = Number(secStr);
    const ms = Number(msStr.padEnd(3, "0").slice(0, 3));
    if (!Number.isFinite(m) || !Number.isFinite(sec) || !Number.isFinite(ms)) return null;
    return (m * 60 + sec) * 1000 + ms;
  }

  // format: seconds(.mmm)
  // examples: "84.567", "59.1", "90"
  if (/^\d+(\.\d{1,3})?$/.test(s)) {
    const [secStr, msStr = "0"] = s.split(".");
    const sec = Number(secStr);
    const ms = Number(msStr.padEnd(3, "0").slice(0, 3));
    if (!Number.isFinite(sec) || !Number.isFinite(ms)) return null;
    return sec * 1000 + ms;
  }

  return null;
}

/**
 * fmtMs formats milliseconds as "mm:ss:mmm" (seconds 2 digits, millis 3 digits).
 * If ms is negative, prefixes "-".
 */
function fmtMs(ms) {
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

module.exports = { parseMs, fmtMs };
