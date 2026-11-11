/**
 * 엑셀(.xlsx)·CSV를 브라우저 안에서 읽고, 양식(.xlsx)을 만들어요. 새 패키지 없이 브라우저 기본 기능만 써요.
 * 파일은 서버로 보내지 않고 이 기기에서만 읽어요. 읽기는 DecompressionStream("deflate-raw")이 필요해요(최신 Chrome·Edge·Safari·Firefox).
 */
export interface SheetRow { n: number; cells: string[] }
export class FileReadError extends Error {}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UNZIPPED = 30 * 1024 * 1024;
const MAX_COLS = 30;

/* ---------- ZIP 읽기 ---------- */
const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);
const utf8 = new TextDecoder("utf-8");

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new FileReadError("이 브라우저는 엑셀 파일을 읽을 수 없어요. 최신 Chrome 또는 Edge에서 열어 주세요. (CSV 파일은 어느 브라우저에서나 올릴 수 있어요)");
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(data as unknown as BufferSource).catch(() => {});
  w.close().catch(() => {});
  const chunks: Uint8Array[] = []; let total = 0;
  const r = ds.readable.getReader();
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    total += value.length;
    if (total > MAX_UNZIPPED) throw new FileReadError("파일 안의 내용이 너무 커요.");
    chunks.push(value);
  }
  const out = new Uint8Array(total); let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<Uint8Array>>> {
  const b = new Uint8Array(buf); const d = new DataView(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) { if (u32(d, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new FileReadError("엑셀(.xlsx) 파일이 아니에요. 다른 형식(.xls 등)이라면 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 바꿔 올려 주세요.");
  const count = u16(d, eocd + 10); let p = u32(d, eocd + 16);
  if (count === 0xffff || p === 0xffffffff) throw new FileReadError("너무 큰 엑셀 파일이에요.");
  const files = new Map<string, () => Promise<Uint8Array>>();
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || u32(d, p) !== 0x02014b50) throw new FileReadError("엑셀 파일이 손상된 것 같아요.");
    const flag = u16(d, p + 8), method = u16(d, p + 10), csize = u32(d, p + 20), usize = u32(d, p + 24);
    const nlen = u16(d, p + 28), elen = u16(d, p + 30), clen = u16(d, p + 32), lho = u32(d, p + 42);
    const name = utf8.decode(b.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (flag & 1) throw new FileReadError("비밀번호가 걸린 파일이에요. 비밀번호를 해제한 뒤 올려 주세요.");
    if (usize > MAX_UNZIPPED) throw new FileReadError("파일 안의 내용이 너무 커요.");
    files.set(name, async () => {
      if (lho + 30 > b.length || u32(d, lho) !== 0x04034b50) throw new FileReadError("엑셀 파일이 손상된 것 같아요.");
      const start = lho + 30 + u16(d, lho + 26) + u16(d, lho + 28);
      const raw = b.subarray(start, start + csize);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new FileReadError("지원하지 않는 압축 방식이에요.");
    });
  }
  return files;
}

/* ---------- XML 도우미 ---------- */
const parseXml = (s: string): Document => {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new FileReadError("엑셀 파일 내용을 읽을 수 없어요. 파일이 손상되었을 수 있어요.");
  return doc;
};
const kids = (el: Element, name: string): Element[] => Array.from(el.children).filter((c) => c.localName === name);
const all = (el: Document | Element, name: string): Element[] => Array.from(el.getElementsByTagNameNS("*", name));
const textOf = (si: Element): string => {
  // <t> 만 이어 붙이고 <rPh>(후리가나)는 건너뛰어요.
  let out = "";
  const walk = (e: Element) => { for (const c of Array.from(e.children)) { if (c.localName === "rPh" || c.localName === "phoneticPr") continue; if (c.localName === "t") out += c.textContent ?? ""; else walk(c); } };
  walk(si);
  return out;
};

/* ---------- 날짜 서식 ---------- */
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function isDateFormat(code: string): boolean {
  const s = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmyhs]/i.test(s.replace(/General/gi, ""));
}
const pad = (n: number) => String(n).padStart(2, "0");
/** 엑셀 날짜 일련번호 → [연,월,일,시,분] (1900/1904 체계) */
export function serialToParts(v: number, date1904: boolean): { y: number; m: number; d: number; hh: number; mm: number } {
  let days = Math.floor(v + 1e-9); let frac = v - days;
  if (!date1904 && days >= 61) days -= 1; // 1900 윤년 버그 보정
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const dt = new Date(base + days * 86400000);
  let mins = Math.round(frac * 1440); if (mins >= 1440) mins = 1439;
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hh: Math.floor(mins / 60), mm: mins % 60 };
}
function dateCellText(v: number, date1904: boolean): string {
  const p = serialToParts(v, date1904);
  if (v < 1) return `${pad(p.hh)}:${pad(p.mm)}`;
  const ds = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  return v % 1 > 1e-9 ? `${ds} ${pad(p.hh)}:${pad(p.mm)}` : ds;
}

const colIndex = (ref: string): number => { let n = 0; for (const ch of ref) { const c = ch.charCodeAt(0); if (c >= 65 && c <= 90) n = n * 26 + (c - 64); else break; } return n - 1; };

/* ---------- xlsx 읽기 ---------- */
/** strict: 이름이 같은 시트가 없으면 첫 시트로 대신하지 않고 빈 결과(sheet "")를 돌려줘요(이벤트 시트가 있는지 확인할 때). */
export async function readXlsx(buf: ArrayBuffer, preferSheet = "일정", strict = false): Promise<{ rows: SheetRow[]; sheet: string }> {
  const files = await unzip(buf);
  const getText = async (name: string): Promise<string | null> => { const f = files.get(name); return f ? utf8.decode(await f()) : null; };
  const wbXml = await getText("xl/workbook.xml");
  if (!wbXml) throw new FileReadError("엑셀(.xlsx) 파일이 아니에요. 엑셀 통합 문서인지 확인해 주세요.");
  const wb = parseXml(wbXml);
  const date1904 = all(wb, "workbookPr").some((e) => /^(1|true)$/i.test(e.getAttribute("date1904") ?? ""));
  const sheets = all(wb, "sheet").map((e) => ({ name: e.getAttribute("name") ?? "", rid: e.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? e.getAttribute("r:id") ?? "", state: e.getAttribute("state") ?? "" }));
  if (!sheets.length) throw new FileReadError("시트가 없는 파일이에요.");
  const relsXml = await getText("xl/_rels/workbook.xml.rels");
  const rels = new Map<string, string>();
  if (relsXml) for (const r of all(parseXml(relsXml), "Relationship")) { let t = r.getAttribute("Target") ?? ""; t = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, ""); rels.set(r.getAttribute("Id") ?? "", t); }
  const visible = sheets.filter((s) => s.state !== "hidden" && s.state !== "veryHidden");
  const named = visible.find((s) => s.name === preferSheet);
  if (strict && !named) return { rows: [], sheet: "" };
  const pick = named ?? visible[0] ?? sheets[0];
  const path = rels.get(pick.rid) ?? "xl/worksheets/sheet1.xml";
  const shXml = await getText(path);
  if (!shXml) throw new FileReadError(`'${pick.name}' 시트를 읽을 수 없어요.`);

  const shared: string[] = [];
  const ssXml = await getText("xl/sharedStrings.xml");
  if (ssXml) for (const si of all(parseXml(ssXml), "si")) shared.push(textOf(si));

  const dateXf: boolean[] = [];
  const stXml = await getText("xl/styles.xml");
  if (stXml) {
    const st = parseXml(stXml);
    const custom = new Map<number, string>();
    for (const nf of all(st, "numFmt")) custom.set(Number(nf.getAttribute("numFmtId")), nf.getAttribute("formatCode") ?? "");
    const cellXfs = all(st, "cellXfs")[0];
    if (cellXfs) for (const xf of kids(cellXfs, "xf")) {
      const id = Number(xf.getAttribute("numFmtId") ?? 0);
      dateXf.push(custom.has(id) ? isDateFormat(custom.get(id) ?? "") : BUILTIN_DATE.has(id));
    }
  }

  const sh = parseXml(shXml);
  const rows: SheetRow[] = [];
  let auto = 0;
  for (const row of all(sh, "row")) {
    const rn = Number(row.getAttribute("r")) || auto + 1; auto = rn;
    const cells: string[] = []; let ci = 0;
    for (const c of kids(row, "c")) {
      const ref = c.getAttribute("r"); if (ref) ci = colIndex(ref);
      if (ci >= MAX_COLS) { ci++; continue; }
      const t = c.getAttribute("t") ?? "n"; const s = Number(c.getAttribute("s") ?? 0);
      const vEl = kids(c, "v")[0]; const v = vEl?.textContent ?? "";
      let text = "";
      if (t === "s") text = shared[Number(v)] ?? "";
      else if (t === "inlineStr") { const is = kids(c, "is")[0]; text = is ? textOf(is) : ""; }
      else if (t === "str") text = v;
      else if (t === "b") text = v === "1" ? "TRUE" : "FALSE";
      else if (t === "e") text = "";
      else if (v !== "") { const num = Number(v); text = Number.isFinite(num) && dateXf[s] ? dateCellText(num, date1904) : Number.isFinite(num) ? String(num) : v; }
      while (cells.length < ci) cells.push("");
      cells[ci] = text.replace(/\r/g, ""); ci++;
    }
    if (cells.some((x) => x.trim() !== "")) rows.push({ n: rn, cells });
  }
  return { rows, sheet: pick.name };
}

/* ---------- CSV 읽기 ---------- */
export function readCsv(buf: ArrayBuffer): SheetRow[] {
  const bytes = new Uint8Array(buf);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { try { text = new TextDecoder("euc-kr").decode(bytes); } catch { throw new FileReadError("CSV 글자 인코딩을 알 수 없어요. UTF-8로 저장해 다시 올려 주세요."); } }
  text = text.replace(/^﻿/, "");
  const first = text.split("\n", 1)[0] ?? "";
  const delim = [",", "\t", ";"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: SheetRow[] = [];
  let cells: string[] = [], cur = "", q = false, n = 1, fieldStart = true, any = false;
  const endRow = () => { cells.push(cur); if (cells.some((x) => x.trim() !== "")) rows.push({ n, cells: cells.slice(0, MAX_COLS) }); cells = []; cur = ""; fieldStart = true; any = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else { cur += ch; if (ch === "\n") n++; } continue; }
    if (ch === '"' && fieldStart) { q = true; fieldStart = false; any = true; continue; }
    if (ch === delim) { cells.push(cur); cur = ""; fieldStart = true; any = true; continue; }
    if (ch === "\n") { endRow(); n++; continue; }
    if (ch === "\r") continue;
    cur += ch; fieldStart = false; any = true;
  }
  if (any || cur) endRow();
  return rows;
}

/** 파일 종류에 맞게 읽어요. */
export async function readSheetFile(file: File): Promise<{ rows: SheetRow[]; sheet: string; buf: ArrayBuffer }> {
  if (file.size === 0) throw new FileReadError("빈 파일이에요.");
  if (file.size > MAX_FILE_BYTES) throw new FileReadError("파일이 너무 커요(5MB 이하). 행을 나눠 여러 번 올려 주세요.");
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (name.endsWith(".xls") && !isZip) throw new FileReadError("예전 형식(.xls)은 읽을 수 없어요. 엑셀에서 '다른 이름으로 저장 → Excel 통합 문서(.xlsx)'로 바꿔 올려 주세요.");
  if (name.endsWith(".csv") || name.endsWith(".txt") || (!isZip && !name.endsWith(".xlsx"))) {
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) throw new FileReadError("엑셀(.xlsx) 또는 CSV 파일만 올릴 수 있어요.");
    return { rows: readCsv(buf), sheet: "CSV", buf };
  }
  const r = await readXlsx(buf);
  return { ...r, buf };
}

/* ---------- xlsx 만들기(양식용) ---------- */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zipStore(entries: { name: string; data: string }[]): Uint8Array {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), data = enc.encode(e.data), crc = crc32(data);
    const lh = new Uint8Array(30 + name.length); const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true);
    lh.set(name, 30);
    const ch = new Uint8Array(46 + name.length); const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    ch.set(name, 46);
    parts.push(lh, data); central.push(ch); offset += lh.length + data.length;
  }
  const cstart = offset; let csize = 0; for (const c of central) { parts.push(c); csize += c.length; }
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, csize, true); ev.setUint32(16, cstart, true);
  parts.push(end);
  const total = parts.reduce((s, p) => s + p.length, 0); const out = new Uint8Array(total); let p = 0;
  for (const x of parts) { out.set(x, p); p += x.length; }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => String.fromCharCode(65 + i);
function sheetXml(rows: string[][], widths: number[], opts: { freeze?: boolean; headerStyle?: number; textCols?: boolean }): string {
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${opts.textCols ? ' style="2"' : ""}/>`).join("");
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === "" ? "" : `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 && opts.headerStyle ? ` s="${opts.headerStyle}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join("")}</row>`).join("");
  const view = opts.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

export const TEMPLATE_HEADERS = ["공연명", "공연장", "공연 시작일", "공연 종료일", "공연일", "공연 시간", "배우명", "공지 링크", "배역명", "장르"];
export const EVENT_TEMPLATE_HEADERS = ["공연명", "이벤트명", "이벤트 시작일", "이벤트 종료일"];

/** 업로드 양식(.xlsx)을 만들어요. '일정'·'이벤트' 시트는 머리글만 있고, '작성 안내' 시트에 설명과 예시가 있어요. */
export function buildTemplateXlsx(): Uint8Array {
  const guide: string[][] = [
    ["[일정 시트]", "", "", ""],
    ["항목", "설명", "필수 여부", "입력 예시"],
    ["공연명", "등록할 공연의 정식 명칭. 이미 등록된 이름과 같으면 기존 공연에 회차만 추가돼요(띄어쓰기·대소문자는 무시).", "필수", "레베카"],
    ["공연장", "공연 장소", "필수", "샤롯데씨어터"],
    ["공연 시작일", "공연 개막일. 2026-11-01 처럼 입력해 주세요.", "필수", "2026-11-01"],
    ["공연 종료일", "공연 종료일", "필수", "2026-12-31"],
    ["공연일", "개별 회차 날짜", "필수", "2026-11-11"],
    ["공연 시간", "해당 회차 시작 시간(24시간제). 14:00 처럼 입력해 주세요.", "필수", "14:00"],
    ["배우명", "해당 회차 출연 배우. 한 칸에 여러 명이면 쉼표(,)나 슬래시(/)로 구분하거나, 배우마다 행을 나눠 주세요.", "필수", "옥주현, 신영숙"],
    ["공지 링크", "예매처·공연 공지 URL(http:// 또는 https://로 시작). 같은 공연의 첫 행에만 적어도 돼요.", "선택", "https://example.com/notice"],
    ["배역명", "선택 칸. 적으면 그 배역에 배우가 들어가요. 배우가 여러 명이면 배우와 같은 순서·같은 개수로 쉼표로 구분하세요. 비워두면 이미 등록된 배우는 원래 배역으로, 처음 보는 배우는 '출연진 1, 2…' 배역으로 들어가요.", "선택", "댄버스 부인"],
    ["장르", "선택 칸. 뮤지컬 또는 연극. 비우면 신규 공연은 뮤지컬로 등록돼요.", "선택", "뮤지컬"],
    ["작성 팁", "공연명은 모든 행에 적어 주세요. 공연장·공연 시작일·공연 종료일·공지 링크·장르는 같은 공연의 첫 행에만 적고 아래 행은 비워도 돼요(같은 공연명의 첫 값을 이어받아요). 한 줄에 회차 1개 + 배우 1명 이상. 같은 회차의 같은 배역에 서로 다른 배우를 넣으면 오류로 알려드려요.", "", ""],
    ["일정 예시", "공연명 | 공연장 | 시작일 | 종료일 | 공연일 | 시간 | 배우명 | 공지 링크 | 배역명", "", ""],
    ["", "레베카 | 샤롯데씨어터 | 2026-11-01 | 2026-12-31 | 2026-11-11 | 14:00 | 옥주현 | https://example.com | 댄버스 부인", "", ""],
    ["", "레베카 | 샤롯데씨어터 | 2026-11-01 | 2026-12-31 | 2026-11-11 | 19:00 | 신영숙 | | 댄버스 부인", "", ""],
    ["", "", "", ""],
    ["[이벤트 시트]", "공연에 딸린 이벤트를 한 행에 하나씩 적어요. 이벤트만 따로 추가·등록할 수도 있어요(일정 시트는 비워 두어도 돼요).", "", ""],
    ["항목", "설명", "필수 여부", "입력 예시"],
    ["공연명", "이벤트가 속한 공연. 일정 시트에 적은 공연이거나, 이미 등록된 공연이어야 해요(띄어쓰기·대소문자는 무시). 없는 공연이면 오류로 알려드려요.", "필수", "레베카"],
    ["이벤트명", "이벤트 이름", "필수", "관객 감사 이벤트"],
    ["이벤트 시작일", "YYYY-MM-DD 형식으로 입력해 주세요.", "필수", "2026-11-15"],
    ["이벤트 종료일", "YYYY-MM-DD 형식. 시작일보다 빠를 수 없어요. 하루짜리면 시작일과 같은 날짜를 적어 주세요.", "필수", "2026-11-20"],
    ["이벤트 규칙", "같은 공연명으로 여러 행을 쓰면 그 공연에 이벤트가 여러 개 등록돼요. 이벤트 기간은 공연 기간과 별개이고, 이벤트끼리 기간이 겹쳐도 등록돼요. 이벤트명이 같아도 기간이 다르면 별개의 이벤트예요. 이벤트명과 기간이 모두 같은 이벤트가 이미 있으면 새로 만들지 않고 건너뛰어요. 이벤트 시트를 비워 두어도 기존 이벤트는 지우거나 바꾸지 않아요. 이벤트 색은 공연 색을 따라가요.", "", ""],
    ["이벤트 예시", "공연명 | 이벤트명 | 이벤트 시작일 | 이벤트 종료일", "", ""],
    ["", "레베카 | 관객 감사 이벤트 | 2026-11-15 | 2026-11-20", "", ""],
    ["", "레베카 | 커튼콜 데이 | 2026-11-25 | 2026-11-25", "", ""],
    ["", "레베카 | 스페셜 포토타임 | 2026-12-01 | 2026-12-03", "", ""],
    ["", "프랑켄슈타인 | 관객 참여 이벤트 | 2026-12-05 | 2026-12-10", "", ""],
  ];
  const sheet1 = sheetXml([TEMPLATE_HEADERS], [18, 18, 14, 14, 14, 12, 24, 30, 16, 10], { freeze: true, headerStyle: 1, textCols: true });
  const sheet2 = sheetXml([EVENT_TEMPLATE_HEADERS], [22, 28, 16, 16], { freeze: true, headerStyle: 1, textCols: true });
  const sheet3 = sheetXml(guide, [14, 90, 10, 24], { headerStyle: 1 });
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="일정" sheetId="1" r:id="rId1"/><sheet name="이벤트" sheetId="2" r:id="rId2"/><sheet name="작성 안내" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  // xf 0 기본 / 1 머리글(굵게·흰 글씨·버건디 배경) / 2 텍스트 서식(@) — 날짜·시간을 글자로 입력해도 엑셀이 마음대로 바꾸지 않게
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7A1F3D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  return zipStore([
    { name: "[Content_Types].xml", data: ct }, { name: "_rels/.rels", data: rels }, { name: "xl/workbook.xml", data: wb },
    { name: "xl/_rels/workbook.xml.rels", data: wbRels }, { name: "xl/styles.xml", data: styles },
    { name: "xl/worksheets/sheet1.xml", data: sheet1 }, { name: "xl/worksheets/sheet2.xml", data: sheet2 }, { name: "xl/worksheets/sheet3.xml", data: sheet3 },
  ]);
}

/** 보안 연결(https)이 아닐 때를 위한 SHA-256 직접 계산 */
function sha256Js(data: Uint8Array): string {
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const len = data.length; const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data); padded[len] = 0x80;
  const dv = new DataView(padded.buffer); dv.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000)); dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64); const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H).map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** 파일 내용의 SHA-256(16진수). 같은 파일을 다시 올렸는지 알아보는 데 써요. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const d = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Js(new Uint8Array(buf));
}
