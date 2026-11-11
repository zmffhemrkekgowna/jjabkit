/**
 * 엑셀 일정 업로드의 판단 로직(화면·DB와 무관한 순수 함수). 입력 행과 지금 등록된 공연을 비교해
 * 신규/기존/중복/오류를 가르고, 등록할 내용을 DB 함수에 넘길 모양으로 만들어요.
 */
import type { Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { FileReadError, serialToParts, type SheetRow } from "./xlsxLite";

export const MAX_IMPORT_ROWS = 2000;
export const SLOT_PREFIX = "출연진";

export interface ImportRow {
  id: number; n: number; // n = 엑셀(파일)의 행 번호
  title: string; venue: string; start: string; end: string; date: string; time: string;
  actor: string; link: string; role: string; genre: string;
}
export type RowField = "title" | "venue" | "start" | "end" | "date" | "time" | "actor" | "link" | "role" | "genre";
export const FIELD_LABEL: Record<RowField, string> = {
  title: "공연명", venue: "공연장", start: "공연 시작일", end: "공연 종료일", date: "공연일", time: "공연 시간",
  actor: "배우명", link: "공지 링크", role: "배역명", genre: "장르",
};
export const ORDER: RowField[] = ["title", "venue", "start", "end", "date", "time", "actor", "link", "role", "genre"]; // 양식의 열 순서(A~J)
const REQUIRED: RowField[] = ["title", "venue", "start", "end", "date", "time", "actor"];

const ALIASES: Record<RowField, string[]> = {
  title: ["공연명", "공연제목", "제목", "작품명", "작품"],
  venue: ["공연장", "공연장소", "장소", "극장"],
  start: ["공연시작일", "시작일", "개막일", "오픈일", "공연기간시작"],
  end: ["공연종료일", "종료일", "폐막일", "마감일", "공연기간종료"],
  date: ["공연일", "공연날짜", "날짜", "회차날짜", "일자", "공연일자"],
  time: ["공연시간", "시간", "시작시간", "회차시간", "공연시작시간"],
  actor: ["배우명", "배우", "출연배우", "출연진", "캐스트", "캐스팅", "배우이름"],
  link: ["공지링크", "링크", "예매링크", "예매처", "url", "공지url", "공지"],
  role: ["배역명", "배역", "역할", "역"],
  genre: ["장르", "분류"],
};
const normHeader = (s: string) => s.replace(/\([^)]*\)|（[^）]*）/g, "").replace(/[\s*＊:：]/g, "").toLowerCase();
const HEADER_LOOKUP = new Map<string, RowField>();
for (const f of Object.keys(ALIASES) as RowField[]) for (const a of ALIASES[f]) HEADER_LOOKUP.set(normHeader(a), f);

/** 시트 행들에서 머리글을 찾고 데이터 행으로 바꿔요. 못 읽으면 FileReadError(사유 포함). */
export function parseSheetRows(sheet: SheetRow[], opts: { allowHeaderless?: boolean } = {}): ImportRow[] {
  let hi = -1; let map = new Map<RowField, number>();
  for (let i = 0; i < Math.min(sheet.length, 10); i++) {
    const m = new Map<RowField, number>();
    sheet[i].cells.forEach((c, ci) => { const f = HEADER_LOOKUP.get(normHeader(c ?? "")); if (f && !m.has(f)) m.set(f, ci); });
    if (m.size >= 3) { hi = i; map = m; break; }
  }
  if (hi < 0 && opts.allowHeaderless) {
    // 머리글 없이 데이터 행만 복사한 경우: 양식의 열 순서(A~J)를 그대로 따라요.
    if (!sheet.some((r) => r.cells.length >= 7)) throw new FileReadError("열이 7개 미만이에요. 엑셀 양식의 공연명~배우명(A~G열)까지 포함해 복사해 주세요. 머리글 없이 붙여넣을 때는 양식과 같은 열 순서여야 해요.");
    map = new Map(ORDER.map((f, i) => [f, i] as [RowField, number])); hi = -1;
  }
  else if (hi < 0) throw new FileReadError("머리글(공연명, 공연장, 공연일 …)을 찾지 못했어요. 업로드 양식을 내려받아 같은 머리글로 작성해 주세요.");
  const missing = REQUIRED.filter((f) => !map.has(f));
  if (missing.length) throw new FileReadError(`필수 열이 없어요: ${missing.map((f) => FIELD_LABEL[f]).join(", ")}. 업로드 양식의 머리글을 그대로 사용해 주세요.`);
  const data = sheet.slice(hi + 1);
  if (data.length === 0) throw new FileReadError("머리글 아래에 입력된 행이 없어요. 머리글 아래의 데이터 행까지 함께 복사해 주세요.");
  if (data.length > MAX_IMPORT_ROWS) throw new FileReadError(`행이 너무 많아요(${data.length}행). 한 번에 ${MAX_IMPORT_ROWS}행까지 올릴 수 있어요. 파일을 나눠 주세요.`);
  const get = (cells: string[], f: RowField) => { const i = map.get(f); return i === undefined ? "" : (cells[i] ?? "").trim(); };
  return data.map((r, i) => ({
    id: i + 1, n: r.n,
    title: get(r.cells, "title"), venue: get(r.cells, "venue"), start: get(r.cells, "start"), end: get(r.cells, "end"),
    date: get(r.cells, "date"), time: get(r.cells, "time"), actor: get(r.cells, "actor"), link: get(r.cells, "link"),
    role: get(r.cells, "role"), genre: get(r.cells, "genre"),
  }));
}

/**
 * 엑셀에서 복사한 글(탭으로 열, 줄바꿈으로 행 구분)을 행·열로 나눠요. 셀 안에 줄바꿈이나 큰따옴표가 있으면 엑셀이 "…"로 감싸서 복사하는데 그것도 풀어줘요.
 * 빈 칸은 그대로 빈 칸으로 남겨 열 위치가 밀리지 않아요. n은 붙여넣은 글의 몇 번째 줄인지(머리글 포함)예요.
 */
export function parsePasted(text: string): SheetRow[] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: SheetRow[] = [];
  let cells: string[] = [], cur = "", q = false, fieldStart = true, line = 1, startLine = 1;
  const end = () => { cells.push(cur); if (cells.some((x) => x.trim() !== "")) rows.push({ n: startLine, cells }); cells = []; cur = ""; fieldStart = true; };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else { cur += ch; if (ch === "\n") line++; } continue; }
    if (ch === '"' && fieldStart) { q = true; fieldStart = false; continue; }
    if (ch === "\t") { cells.push(cur); cur = ""; fieldStart = true; continue; }
    if (ch === "\n") { end(); line++; startLine = line; continue; }
    cur += ch; fieldStart = false;
  }
  if (cur || cells.length) end();
  if (rows.length > MAX_IMPORT_ROWS + 10) throw new FileReadError(`행이 너무 많아요(${rows.length}행). 한 번에 ${MAX_IMPORT_ROWS}행까지 붙여넣을 수 있어요. 나눠서 붙여넣어 주세요.`);
  if (rows.length && rows.every((r) => r.cells.length < 2)) throw new FileReadError("열이 구분되지 않았어요. 엑셀에서 셀을 선택해 복사(Ctrl+C)한 내용을 붙여넣어 주세요. 메모장·한글 등에서 복사한 글은 열을 알아볼 수 없어요.");
  return rows;
}

/* ---------- 이벤트 시트 ---------- */
export const MAX_IMPORT_EVENTS = 2000;
export interface EventImportRow { id: number; n: number; show: string; title: string; start: string; end: string }
export type EventField = "show" | "title" | "start" | "end";
export const EVENT_FIELD_LABEL: Record<EventField, string> = { show: "공연명", title: "이벤트명", start: "이벤트 시작일", end: "이벤트 종료일" };
export const EVENT_ORDER: EventField[] = ["show", "title", "start", "end"]; // 이벤트 시트의 열 순서(A~D)
const EVENT_ALIASES: Record<EventField, string[]> = {
  show: ["공연명", "공연제목", "작품명", "작품", "공연"],
  title: ["이벤트명", "이벤트제목", "이벤트이름", "이벤트", "행사명"],
  start: ["이벤트시작일", "이벤트시작", "이벤트기간시작", "행사시작일"],
  end: ["이벤트종료일", "이벤트종료", "이벤트기간종료", "행사종료일"],
};
const EVENT_LOOKUP = new Map<string, EventField>();
for (const f of Object.keys(EVENT_ALIASES) as EventField[]) for (const a of EVENT_ALIASES[f]) EVENT_LOOKUP.set(normHeader(a), f);

/** 붙여넣은 내용이 어느 시트의 것인지 머리글로 알아봐요(일정 칸에 이벤트를, 이벤트 칸에 일정을 붙여넣은 실수를 알려 주려고). */
export function sheetKind(sheet: SheetRow[]): "schedule" | "event" | "unknown" {
  const EV = new Set(["이벤트명", "이벤트시작일", "이벤트종료일", "이벤트제목"].map(normHeader));
  const SC = new Set(["공연장", "공연일", "공연시간", "배우명", "공연시작일", "공연종료일"].map(normHeader));
  let ev = 0, sc = 0;
  for (const r of sheet.slice(0, 10)) for (const c of r.cells) { const k = normHeader(c ?? ""); if (EV.has(k)) ev++; if (SC.has(k)) sc++; }
  return ev >= 2 && ev > sc ? "event" : sc >= 2 && sc > ev ? "schedule" : "unknown";
}

/** 이벤트 시트(공연명, 이벤트명, 이벤트 시작일, 이벤트 종료일)를 행으로 바꿔요. 머리글 없이 붙여넣으면 양식의 열 순서(A~D)를 따라요. */
export function parseEventSheetRows(sheet: SheetRow[], opts: { allowHeaderless?: boolean } = {}): EventImportRow[] {
  let hi = -1; let map = new Map<EventField, number>();
  for (let i = 0; i < Math.min(sheet.length, 10); i++) {
    const m = new Map<EventField, number>();
    sheet[i].cells.forEach((c, ci) => { const f = EVENT_LOOKUP.get(normHeader(c ?? "")); if (f && !m.has(f)) m.set(f, ci); });
    if (m.size >= 3) { hi = i; map = m; break; }
  }
  if (hi < 0 && opts.allowHeaderless) {
    if (sheet.some((r) => r.cells.length >= 7)) throw new FileReadError("열이 너무 많아요. 일정 시트 내용 같아요 — 이벤트 시트(공연명·이벤트명·이벤트 시작일·이벤트 종료일 4열)를 복사해 붙여넣어 주세요.");
    if (!sheet.some((r) => r.cells.length >= 4)) throw new FileReadError("열이 4개 미만이에요. 이벤트 시트의 A~D열(공연명, 이벤트명, 이벤트 시작일, 이벤트 종료일)을 함께 복사해 주세요. 머리글 없이 붙여넣을 때는 양식과 같은 열 순서여야 해요.");
    map = new Map(EVENT_ORDER.map((f, i) => [f, i] as [EventField, number])); hi = -1;
  } else if (hi < 0) throw new FileReadError("이벤트 머리글(공연명, 이벤트명, 이벤트 시작일, 이벤트 종료일)을 찾지 못했어요. 업로드 양식의 '이벤트' 시트를 복사해 주세요.");
  const missing = EVENT_ORDER.filter((f) => !map.has(f));
  if (missing.length) throw new FileReadError(`이벤트 시트에 필수 열이 없어요: ${missing.map((f) => EVENT_FIELD_LABEL[f]).join(", ")}. 양식의 머리글을 그대로 사용해 주세요.`);
  const data = sheet.slice(hi + 1);
  if (data.length === 0) throw new FileReadError("이벤트 머리글 아래에 입력된 행이 없어요. 데이터 행까지 함께 복사해 주세요.");
  if (data.length > MAX_IMPORT_EVENTS) throw new FileReadError(`이벤트 행이 너무 많아요(${data.length}행). 한 번에 ${MAX_IMPORT_EVENTS}행까지 올릴 수 있어요.`);
  const get = (cells: string[], f: EventField) => { const i = map.get(f); return i === undefined ? "" : (cells[i] ?? "").trim(); };
  return data.map((r, i) => ({ id: i + 1, n: r.n, show: get(r.cells, "show"), title: get(r.cells, "title"), start: get(r.cells, "start"), end: get(r.cells, "end") }));
}

/* ---------- 값 정리 ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
export const normKey = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const calendarOk = (y: number, m: number, d: number) => { if (y < 2000 || y > 2100) return false; const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

/** 날짜 칸 → YYYY-MM-DD. 못 읽으면 null. */
export function normDate(raw: string): string | null {
  let s = raw.trim().replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*[월화수목금토일]요일\s*$/, "").replace(/\s+[월화수목금토일]$/, "").trim();
  if (!s) return null;
  s = s.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$/, "").replace(/\.$/, "").trim();
  let m = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/.exec(s) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) { const y = +m[1], mo = +m[2], d = +m[3]; return calendarOk(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  m = /^(\d{5})(\.\d+)?$/.exec(s);
  if (m) { const v = Number(s); if (v >= 36526 && v <= 73415) { const p = serialToParts(v, false); return calendarOk(p.y, p.m, p.d) ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : null; } }
  return null;
}

/** 시간 칸 → HH:mm. 못 읽으면 null. */
export function normTime(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}[T\s]+/, "");
  const frac = /^0?\.(\d+)$/.exec(s);
  if (frac) { const mins = Math.round(Number(s) * 1440); return mins >= 0 && mins < 1440 ? `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` : null; }
  let ampm: "am" | "pm" | null = null;
  const pre = /^(오전|오후|am|pm|a\.m\.|p\.m\.)\s*/i.exec(s);
  if (pre) { ampm = /오후|pm|p\.m/i.test(pre[1]) ? "pm" : "am"; s = s.slice(pre[0].length); }
  const post = /\s*(오전|오후|am|pm|a\.m\.|p\.m\.)$/i.exec(s);
  if (post) { ampm = /오후|pm|p\.m/i.test(post[1]) ? "pm" : "am"; s = s.slice(0, s.length - post[0].length); }
  let h: number, mi: number;
  let m = /^(\d{1,2})\s*:\s*(\d{2})(\s*:\s*\d{2})?$/.exec(s);
  if (m) { h = +m[1]; mi = +m[2]; }
  else if ((m = /^(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분?)?$/.exec(s))) { h = +m[1]; mi = m[2] ? +m[2] : 0; }
  else if ((m = /^(\d{2})(\d{2})$/.exec(s))) { h = +m[1]; mi = +m[2]; }
  else if ((m = /^(\d{1,2})$/.exec(s)) && ampm) { h = +m[1]; mi = 0; }
  else return null;
  if (ampm) { if (h < 1 || h > 12) return null; h = (h % 12) + (ampm === "pm" ? 12 : 0); }
  if (h > 23 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}

const splitNames = (s: string) => s.split(/[,，、/;\n]+/).map((x) => x.trim()).filter(Boolean);
const normGenre = (s: string): "뮤지컬" | "연극" | null => { const k = normKey(s); return k === "뮤지컬" || k === "musical" ? "뮤지컬" : k === "연극" || k === "play" ? "연극" : null; };
const validLink = (s: string) => /^https?:\/\/[^\s]+$/i.test(s) && s.length <= 500;
const showRange = (a: string, b: string, c: string, d: string) => !!a && !!b && !!c && !!d && a <= d && c <= b;

/* ---------- 분석 ---------- */
export type RowStatus = "error" | "excluded" | "new" | "existing" | "dup";
export interface AnalyzedRow {
  id: number; n: number; raw: ImportRow; status: RowStatus;
  errors: string[]; warns: string[]; notes: string[];
  groupKey: string; title: string; date: string; time: string;
  cast: { role: string; actor: string }[]; roleText: string;
}
export type ShowChoice = "existing" | "new";
export interface ShowGroup {
  key: string; title: string; venue: string; start: string; end: string; genre: string; link: string;
  existingId: string | null; existingTitle: string; existingPeriod: string; periodMatch: boolean;
  mode: ShowChoice; rowIds: number[];
  rows: number; validRows: number; errorRows: number; newSessions: number; existingSessions: number;
}
export interface Analysis {
  rows: AnalyzedRow[]; groups: ShowGroup[];
  counts: { total: number; errors: number; excluded: number; dups: number; warnRows: number; newShows: number; existingShows: number; newSessions: number; existingSessions: number; newRows: number; existingRows: number; assignments: number };
}
export interface AnalyzeOptions { updateCast: boolean; choice: Record<string, ShowChoice>; excluded: Set<number> }

const periodText = (s: string, e: string) => (s || e ? `${s.replace(/-/g, ".")} ~ ${e.replace(/-/g, ".")}` : "기간 없음");

export function analyze(input: ImportRow[], shows: Show[], opt: AnalyzeOptions): Analysis {
  const out: AnalyzedRow[] = input.map((r) => ({
    id: r.id, n: r.n, raw: r, status: "new", errors: [], warns: [], notes: [], groupKey: "", title: r.title.trim(), date: "", time: "", cast: [], roleText: "",
  }));
  for (const r of out) if (opt.excluded.has(r.id)) r.status = "excluded"; // 제외한 행도 '공연장·기간 빈칸 채우기'의 출처로는 써요

  /* 1) 칸별 점검 */
  type P = { venue: string; start: string; end: string; genre: string; link: string; actors: string[]; roles: string[] };
  const parsed = new Map<number, P>();
  for (const r of out) {
    const raw = r.raw; const e = r.errors;
    if (!raw.title.trim()) e.push("공연명이 비어 있어요"); else if (raw.title.trim().length > 100) e.push("공연명이 너무 길어요(100자 이내)"); else r.groupKey = normKey(raw.title);
    let venue = raw.venue.trim(); if (venue.length > 100) { e.push("공연장이 너무 길어요(100자 이내)"); venue = ""; }
    let start = "", end = "";
    if (raw.start.trim()) { const d = normDate(raw.start); if (d) start = d; else e.push(`공연 시작일 형식을 읽을 수 없어요: '${raw.start}' (예: 2026-11-01)`); }
    if (raw.end.trim()) { const d = normDate(raw.end); if (d) end = d; else e.push(`공연 종료일 형식을 읽을 수 없어요: '${raw.end}' (예: 2026-12-31)`); }
    if (!raw.date.trim()) e.push("공연일이 비어 있어요"); else { const d = normDate(raw.date); if (d) r.date = d; else e.push(`공연일 형식을 읽을 수 없어요: '${raw.date}' (예: 2026-11-11)`); }
    if (!raw.time.trim()) e.push("공연 시간이 비어 있어요"); else { const t = normTime(raw.time); if (t) r.time = t; else e.push(`공연 시간 형식을 읽을 수 없어요: '${raw.time}' (예: 14:00)`); }
    const actors = splitNames(raw.actor);
    if (!actors.length) e.push("배우명이 비어 있어요");
    else if (actors.some((a) => a.length > 40)) e.push("배우 이름이 너무 길어요(40자 이내) — 여러 명은 쉼표(,)로 구분해 주세요");
    const roles = splitNames(raw.role);
    if (roles.some((a) => a.length > 40)) e.push("배역명이 너무 길어요(40자 이내)");
    let genre = "";
    if (raw.genre.trim()) { const g = normGenre(raw.genre); if (g) genre = g; else e.push(`장르는 '뮤지컬' 또는 '연극'만 쓸 수 있어요: '${raw.genre}'`); }
    let link = raw.link.trim();
    if (link && !validLink(link)) { e.push(`공지 링크는 http:// 또는 https://로 시작하는 주소여야 해요: '${raw.link.slice(0, 40)}'`); link = ""; }
    if (roles.length && actors.length) {
      if (roles.length === 1 && actors.length > 1) e.push("배역 1개에 배우가 여러 명이에요 — 한 회차의 한 배역에는 배우 1명만 들어가요. 배역명을 배우 수만큼 쓰거나 배우를 줄여 주세요");
      else if (roles.length !== actors.length) e.push(`배역명(${roles.length}개)과 배우명(${actors.length}명)의 개수가 달라요`);
    }
    if (new Set(actors.map(normKey)).size < actors.length) e.push("같은 배우가 한 칸에 두 번 적혀 있어요");
    parsed.set(r.id, { venue, start, end, genre, link, actors, roles });
  }

  /* 2) 공연 묶음: 같은 공연명이면 비어 있는 공연장·기간·링크·장르를 첫 유효값으로 채워요 */
  for (const r of out) if (r.status === "excluded") { r.errors = []; r.warns = []; }
  const live = out.filter((r) => r.status !== "excluded");
  const byKey = new Map<string, AnalyzedRow[]>();
  for (const r of out) if (r.groupKey) byKey.set(r.groupKey, [...(byKey.get(r.groupKey) ?? []), r]);
  const groups: ShowGroup[] = [];
  const showByKey = new Map<string, Show[]>();
  for (const s of shows) showByKey.set(normKey(s.title), [...(showByKey.get(normKey(s.title)) ?? []), s]);
  const gInfo = new Map<string, { g: ShowGroup; show: Show | null; rows: AnalyzedRow[] }>();
  for (const [key, rows] of byKey) {
    const first = <K extends "venue" | "start" | "end" | "genre" | "link">(k: K) => { for (const r of rows) { const v = parsed.get(r.id)![k]; if (v) return { v, n: r.n }; } return { v: "", n: 0 }; };
    const venue = first("venue"), start = first("start"), end = first("end"), genre = first("genre"), link = first("link");
    for (const r of rows) {
      if (r.status === "excluded") continue;
      const p = parsed.get(r.id)!;
      const diff = (lbl: string, own: string, g: { v: string; n: number }) => { if (own && g.v && own !== g.v && g.n !== r.n) r.warns.push(`${lbl}이(가) ${g.n}행과 달라요 — ${g.n}행 값(${g.v})으로 등록돼요`); };
      diff("공연장", p.venue, venue); diff("공연 시작일", p.start, start); diff("공연 종료일", p.end, end); diff("장르", p.genre, genre);
      if (!venue.v) r.errors.push("공연장이 비어 있어요"); if (!start.v && !r.errors.some((x) => x.startsWith("공연 시작일"))) r.errors.push("공연 시작일이 비어 있어요");
      if (!end.v && !r.errors.some((x) => x.startsWith("공연 종료일"))) r.errors.push("공연 종료일이 비어 있어요");
      if (start.v && end.v && start.v > end.v) r.errors.push(`공연 시작일(${start.v})이 종료일(${end.v})보다 늦어요`);
      if (r.date && start.v && end.v && start.v <= end.v && (r.date < start.v || r.date > end.v)) r.warns.push(`공연일이 공연 기간(${periodText(start.v, end.v)}) 밖이에요`);
    }
    const cands = showByKey.get(key) ?? [];
    const matchP = cands.find((s) => showRange(s.start, s.end, start.v, end.v));
    const ex = matchP ?? cands[0] ?? null;
    const mode: ShowChoice = ex ? (opt.choice[key] ?? "existing") : "new";
    const title = rows[0].title;
    const liveRows = rows.filter((r) => r.status !== "excluded");
    const g: ShowGroup = {
      key, title, venue: venue.v, start: start.v, end: end.v, genre: genre.v || ex?.genre || "뮤지컬", link: link.v,
      existingId: ex?.id ?? null, existingTitle: ex?.title ?? "", existingPeriod: ex ? periodText(ex.start, ex.end) : "", periodMatch: !!matchP,
      mode, rowIds: rows.map((r) => r.id), rows: rows.length, validRows: 0, errorRows: 0, newSessions: 0, existingSessions: 0,
    };
    gInfo.set(key, { g, show: mode === "existing" ? ex : null, rows });
    groups.push(g);
    if (ex && mode === "existing" && !matchP) for (const r of liveRows) r.warns.push(`같은 이름의 기존 공연이 있지만 기간이 달라요(기존 ${g.existingPeriod}) — 위 '새 공연으로 등록'으로 바꿀 수 있어요`);
  }

  /* 3) 배역 정하기와 회차 중복 점검 */
  for (const { g, show, rows: allRows } of gInfo.values()) {
    const rows = allRows.filter((r) => r.status !== "excluded");
    const roleNames = new Map<string, string>(); // 정규화된 배역명 → 표시 이름
    const actorRoles = new Map<string, Set<string>>(); // 배우 → 배역(정규화)
    const addAR = (a: string, rk: string) => { const k = normKey(a); actorRoles.set(k, (actorRoles.get(k) ?? new Set()).add(rk)); };
    if (show) for (const ro of show.roles) { roleNames.set(normKey(ro.name), ro.name); for (const ac of ro.actors) addAR(ac.n, normKey(ro.name)); }
    // 엑셀에서 배역을 직접 적은 짝을 먼저 모아요
    const pairsOf = (r: AnalyzedRow) => { const p = parsed.get(r.id)!; return p.roles.length === p.actors.length ? p.actors.map((a, i) => ({ actor: a, role: p.roles[i] })) : null; };
    for (const r of rows) { if (r.errors.length) continue; const ps = pairsOf(r); if (ps) for (const x of ps) { roleNames.set(normKey(x.role), roleNames.get(normKey(x.role)) ?? x.role); addAR(x.actor, normKey(x.role)); } }
    const used = new Map<string, Map<string, { actor: string; n: number }>>(); // 회차 → 배역 → 배우
    const slotOf = new Map<string, string>(); // 배우 → 자동 배정한 '출연진 N'
    const sessKey = (r: AnalyzedRow) => `${r.date} ${r.time}`;
    const register = (r: AnalyzedRow, pairs: { role: string; actor: string }[]): boolean => {
      const u = used.get(sessKey(r)) ?? new Map<string, { actor: string; n: number }>(); used.set(sessKey(r), u);
      let ok = true;
      // 한 행 안에서 같은 배역에 서로 다른 배우를 적은 경우(예: 배우명 '옥주현, 신영숙' / 배역명 '댄버스, 댄버스')도 같은 회차의 한 배역에는 1명만 가능해요
      const inRowRole = new Map<string, string>();
      for (const p of pairs) { const k = normKey(p.role); const prev = inRowRole.get(k); if (prev !== undefined && normKey(prev) !== normKey(p.actor)) { r.errors.push(`같은 행에서 '${p.role}' 배역에 배우가 2명('${prev}', '${p.actor}')이에요 — 한 회차의 한 배역에는 배우 1명만 가능해요. 회차(행)를 나눠 적어 주세요`); return false; } inRowRole.set(k, p.actor); }
      for (const p of pairs) { const c = u.get(normKey(p.role)); if (c && normKey(c.actor) !== normKey(p.actor)) { r.errors.push(`같은 회차의 '${p.role}' 배역에 이미 '${c.actor}'(${c.n}행)가 있어요 — 한 회차의 한 배역에는 배우 1명만 가능해요`); ok = false; } }
      if (!ok) return false;
      let allDup = true;
      for (const p of pairs) { if (!u.has(normKey(p.role))) { u.set(normKey(p.role), { actor: p.actor, n: r.n }); allDup = false; } }
      if (allDup) r.status = "dup";
      return true;
    };
    const explicitFirst = [...rows.filter((r) => !r.errors.length && pairsOf(r)), ...rows.filter((r) => !r.errors.length && !pairsOf(r))];
    for (const r of explicitFirst) {
      if (r.errors.length) continue;
      const p = parsed.get(r.id)!; const ps = pairsOf(r);
      let pairs: { role: string; actor: string }[];
      if (ps) pairs = ps.map((x) => ({ actor: x.actor, role: roleNames.get(normKey(x.role)) ?? x.role }));
      else {
        pairs = []; const bad: string[] = []; const inRow = new Set<string>();
        for (const a of p.actors) {
          const ak = normKey(a); const set = actorRoles.get(ak);
          if (set && set.size === 1) { const rk = [...set][0]; pairs.push({ actor: a, role: roleNames.get(rk) ?? rk }); }
          else if (set && set.size > 1) bad.push(a);
          else {
            let slot = slotOf.get(ak);
            const taken = (nm: string) => inRow.has(normKey(nm)) || (() => { const c = used.get(sessKey(r))?.get(normKey(nm)); return !!c && normKey(c.actor) !== ak; })();
            const free = () => { let n = 1; while (taken(`${SLOT_PREFIX} ${n}`)) n++; return `${SLOT_PREFIX} ${n}`; };
            if (!slot) { slot = free(); slotOf.set(ak, slot); } else if (taken(slot)) slot = free();
            inRow.add(normKey(slot));
            pairs.push({ actor: a, role: slot }); r.warns.push(`'${a}'의 배역을 알 수 없어 '${slot}'(으)로 넣어요 — 배역명 칸에 적으면 그 배역으로 들어가요`);
            roleNames.set(normKey(slot), slot); addAR(a, normKey(slot));
          }
        }
        if (bad.length) { r.errors.push(`${bad.map((a) => `'${a}'`).join(", ")}은(는) 이 공연의 여러 배역에 등록돼 있어요 — 배역명 칸에 어느 배역인지 적어 주세요`); continue; }
      }
      if (!register(r, pairs)) continue;
      r.cast = pairs; r.roleText = pairs.map((x) => x.role).join(", ");
      if (new Set(pairs.map((x) => normKey(x.actor))).size < pairs.length) r.errors.push("같은 배우가 한 행에 두 번 들어갔어요");
      // 같은 회차에서 한 배우가 두 배역이면 알려요
      const u = used.get(sessKey(r))!; const seen = new Map<string, string>();
      for (const [rk, v] of u) { const ak = normKey(v.actor); if (seen.has(ak) && seen.get(ak) !== rk && pairs.some((x) => normKey(x.actor) === ak)) { r.warns.push(`'${v.actor}'이(가) 같은 회차에 두 배역으로 들어가요`); break; } seen.set(ak, rk); }
    }

    /* 4) 기존 회차와 비교 */
    const exSess = new Map<string, Show["sessions"][number]>();
    if (show) for (const s of show.sessions) exSess.set(`${s.date} ${s.time.slice(0, 5)}`, s);
    for (const r of rows) {
      if (r.errors.length || r.status === "dup") continue;
      const es = exSess.get(sessKey(r));
      if (!es) { r.status = "new"; continue; }
      r.status = "existing";
      if (!show) continue;
      const diffs: string[] = []; const adds: string[] = [];
      for (const c of r.cast) {
        const role = show.roles.find((x) => normKey(x.name) === normKey(c.role));
        if (!role) { adds.push(c.role); continue; }
        const cur = es.cast[role.id] ? role.actors.find((a) => a.id === es.cast[role.id])?.n : undefined;
        if (cur === undefined) adds.push(c.role); else if (normKey(cur) !== normKey(c.actor)) diffs.push(`${c.role}: 기존 ${cur} / 엑셀 ${c.actor}`);
      }
      if (diffs.length) r.notes.push(opt.updateCast ? `캐스팅을 엑셀대로 바꿔요 (${diffs.join(", ")})` : `이미 등록된 회차예요. 기존 캐스팅을 유지해요 (${diffs.join(", ")})`);
      else if (adds.length) r.notes.push(opt.updateCast ? `비어 있던 배역을 채워요 (${adds.join(", ")})` : "이미 등록된 회차예요. 기존 캐스팅을 유지해요");
      else r.notes.push("이미 등록된 회차와 같은 내용이에요");
    }
    if (show) for (const r of rows) {
      if (r.errors.length || r.status === "dup") continue;
      if (r.status === "new" || opt.updateCast) for (const c of r.cast) if (!show.roles.some((x) => normKey(x.name) === normKey(c.role))) { r.warns.push(`새 배역 '${c.role}'이(가) 이 공연에 추가돼요`); break; }
    }
  }

  /* 5) 상태·집계 */
  for (const r of live) if (r.errors.length) r.status = "error";
  const sessNew = new Map<string, Set<string>>(), sessOld = new Map<string, Set<string>>();
  for (const r of live) {
    const gi = gInfo.get(r.groupKey); if (!gi) continue;
    if (r.status === "error") gi.g.errorRows++; else gi.g.validRows++;
    const sk = `${r.date} ${r.time}`;
    if (r.status === "new") sessNew.set(r.groupKey, (sessNew.get(r.groupKey) ?? new Set()).add(sk));
    if (r.status === "existing") sessOld.set(r.groupKey, (sessOld.get(r.groupKey) ?? new Set()).add(sk));
  }
  let newShows = 0, existingShows = 0, newSessions = 0, existingSessions = 0;
  for (const { g } of gInfo.values()) {
    g.newSessions = sessNew.get(g.key)?.size ?? 0; g.existingSessions = sessOld.get(g.key)?.size ?? 0;
    if (g.validRows > 0) { if (g.mode === "new") newShows++; else existingShows++; }
    newSessions += g.newSessions; existingSessions += g.existingSessions;
  }
  const c = { total: out.length, errors: 0, excluded: 0, dups: 0, warnRows: 0, newShows, existingShows, newSessions, existingSessions, newRows: 0, existingRows: 0, assignments: 0 };
  for (const r of out) {
    if (r.status === "error") c.errors++; else if (r.status === "excluded") c.excluded++; else if (r.status === "dup") c.dups++;
    else if (r.status === "new") { c.newRows++; c.assignments += r.cast.length; } else if (r.status === "existing") { c.existingRows++; if (opt.updateCast) c.assignments += r.cast.length; }
    if (r.status !== "error" && r.status !== "excluded" && r.warns.length) c.warnRows++;
  }
  return { rows: out, groups, counts: c };
}

/* ---------- 이벤트 분석 ---------- */
export type EventStatus = "error" | "excluded" | "new" | "existing" | "dup";
export interface AnalyzedEvent {
  id: number; n: number; raw: EventImportRow; status: EventStatus; errors: string[]; warns: string[]; notes: string[];
  groupKey: string; show: string; title: string; start: string; end: string;
  /** 이벤트가 붙을 공연: sheet = 이번 일정 시트에서 함께 등록하는 공연, existing = 이미 등록된 공연 */
  target: { kind: "sheet" | "existing"; showId: string | null; showTitle: string } | null;
}
export interface EventGroup { key: string; title: string; kind: "sheet-new" | "sheet-existing" | "existing" | "missing"; showId: string | null; color: string; rowIds: number[]; newEvents: number; existingEvents: number; errorRows: number }
export interface EventAnalysis {
  rows: AnalyzedEvent[]; groups: EventGroup[];
  counts: { total: number; errors: number; excluded: number; dups: number; existing: number; newEvents: number; shows: number; warnRows: number };
}

const evPeriod = (s: string, e: string) => (s === e ? s : `${s} ~ ${e}`);

/**
 * 이벤트 행을 검사해요. 이벤트가 붙을 공연은 ① 이번에 붙여넣은 일정 시트의 공연(등록되는 경우) ② 이미 등록된 공연 순서로 찾아요.
 * 이벤트 기간은 공연 기간과 별개라서 공연 기간 밖이어도, 다른 이벤트와 겹쳐도 오류가 아니에요.
 * existingEvents는 DB에 이미 있는 이벤트(같은 공연·같은 이름·같은 기간이면 건너뛰어요).
 */
export function analyzeEvents(input: EventImportRow[], shows: Show[], existingEvents: EventItem[], schedule: Analysis | null, excluded: Set<number>): EventAnalysis {
  const rows: AnalyzedEvent[] = input.map((r) => ({
    id: r.id, n: r.n, raw: r, status: excluded.has(r.id) ? "excluded" : "new", errors: [], warns: [], notes: [], groupKey: "",
    show: r.show.trim(), title: r.title.trim(), start: "", end: "", target: null,
  }));
  const showByKey = new Map<string, Show[]>();
  for (const s of shows) showByKey.set(normKey(s.title), [...(showByKey.get(normKey(s.title)) ?? []), s]);

  for (const r of rows) {
    if (r.status === "excluded") continue;
    const e = r.errors, raw = r.raw;
    if (!raw.show.trim()) e.push("공연명이 비어 있어요"); else if (raw.show.trim().length > 100) e.push("공연명이 너무 길어요(100자 이내)"); else r.groupKey = normKey(raw.show);
    if (!raw.title.trim()) e.push("이벤트명이 비어 있어요"); else if (raw.title.trim().length > 100) e.push("이벤트명이 너무 길어요(100자 이내)");
    if (!raw.start.trim()) e.push("이벤트 시작일이 비어 있어요"); else { const d = normDate(raw.start); if (d) r.start = d; else e.push(`이벤트 시작일 형식을 읽을 수 없어요: '${raw.start}' (예: 2026-11-15)`); }
    if (!raw.end.trim()) e.push("이벤트 종료일이 비어 있어요"); else { const d = normDate(raw.end); if (d) r.end = d; else e.push(`이벤트 종료일 형식을 읽을 수 없어요: '${raw.end}' (예: 2026-11-20)`); }
    if (r.start && r.end && r.start > r.end) e.push(`이벤트 시작일(${r.start})이 종료일(${r.end})보다 늦어요`);

    if (r.groupKey) {
      // ① 이번 일정 시트에서 등록되는 공연
      const g = schedule?.groups.find((x) => x.key === r.groupKey);
      const registrable = !!g && schedule!.rows.some((x) => g.rowIds.includes(x.id) && (x.status === "new" || x.status === "existing"));
      if (g && registrable) {
        r.target = { kind: "sheet", showId: g.mode === "existing" ? g.existingId : null, showTitle: g.title };
      } else {
        const cands = showByKey.get(r.groupKey) ?? [];
        const hit = (r.start && r.end ? cands.find((s) => s.start && s.end && s.start <= r.end && r.start <= s.end) : undefined) ?? cands[0];
        if (hit) {
          r.target = { kind: "existing", showId: hit.id, showTitle: hit.title };
          if (cands.length > 1) r.warns.push(`같은 이름의 공연이 ${cands.length}개 있어요 — '${hit.title}'(${hit.start || "?"} ~ ${hit.end || "?"})에 등록돼요`);
          if (g && !registrable) r.warns.push("이번 일정 시트의 이 공연 행에 오류가 있어 일정은 등록되지 않아요 — 이벤트는 이미 등록된 같은 이름의 공연에 붙어요");
        } else if (g) e.push("이번 일정 시트의 이 공연 행에 오류가 있어 공연이 등록되지 않아요. 일정 시트의 오류를 먼저 고쳐 주세요");
        else e.push(`'${raw.show.trim()}' 공연을 찾을 수 없어요 — 일정 시트에 함께 적거나, 이미 등록된 공연명과 같아야 해요(띄어쓰기·대소문자는 무시)`);
      }
    }
  }

  // 같은 이벤트(같은 공연·이름·기간)의 중복과, 이미 등록된 이벤트
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "new" || r.errors.length || !r.target) continue;
    const tk = r.target.showId ?? `sheet:${r.groupKey}`;
    const k = `${tk}|${normKey(r.title)}|${r.start}|${r.end}`;
    const first = seen.get(k);
    if (first !== undefined) { r.status = "dup"; r.notes.push(`같은 이벤트가 ${first}행에 이미 있어요 — 건너뛰어요`); continue; }
    seen.set(k, r.n);
    if (r.target.showId && existingEvents.some((x) => x.showId === r.target!.showId && normKey(x.title) === normKey(r.title) && x.startsOn === r.start && (x.endsOn || x.startsOn) === r.end)) {
      r.status = "existing"; r.notes.push("이미 등록된 이벤트예요(같은 공연·이름·기간) — 건너뛰어요");
    }
  }
  for (const r of rows) if (r.status !== "excluded" && r.errors.length) r.status = "error";

  // 공연별 묶음
  const byKey = new Map<string, AnalyzedEvent[]>();
  for (const r of rows) { const k = r.groupKey || `__${r.id}`; byKey.set(k, [...(byKey.get(k) ?? []), r]); }
  const groups: EventGroup[] = [];
  for (const [key, list] of byKey) {
    const withTarget = list.find((x) => x.target);
    const t = withTarget?.target ?? null;
    const sg = schedule?.groups.find((x) => x.key === key);
    const showObj = t?.showId ? shows.find((x) => x.id === t.showId) : undefined;
    const kind: EventGroup["kind"] = !t ? "missing" : t.kind === "sheet" ? (t.showId ? "sheet-existing" : "sheet-new") : "existing";
    groups.push({
      key, title: t?.showTitle || list[0].show || "(공연명 없음)", kind, showId: t?.showId ?? null, color: showObj?.color ?? "",
      rowIds: list.map((x) => x.id), newEvents: list.filter((x) => x.status === "new").length, existingEvents: list.filter((x) => x.status === "existing").length,
      errorRows: list.filter((x) => x.status === "error").length,
    });
    void sg;
  }
  const c = { total: rows.length, errors: 0, excluded: 0, dups: 0, existing: 0, newEvents: 0, shows: 0, warnRows: 0 };
  for (const r of rows) {
    if (r.status === "error") c.errors++; else if (r.status === "excluded") c.excluded++; else if (r.status === "dup") c.dups++; else if (r.status === "existing") c.existing++; else c.newEvents++;
    if (r.status !== "error" && r.status !== "excluded" && r.warns.length) c.warnRows++;
  }
  c.shows = groups.filter((g) => g.newEvents > 0).length;
  return { rows, groups, counts: c };
}

/* ---------- DB 함수에 넘길 내용 ---------- */
export interface SkippedItem { row: number; title: string; date: string; time: string; actor: string; reason: string }
export interface ImportPayload {
  shows: { key: string; title: string; mode: ShowChoice; show_id: string | null; force_new: boolean; venue: string; start: string; end: string; genre: string; link: string;
    sessions: { date: string; time: string; cast: { role: string; actor: string }[] }[] }[];
  /** 이벤트: 이번에 함께 등록하는 공연이면 show_key, 이미 등록된 공연이면 show_id로 공연을 가리켜요. */
  events: { show_key: string | null; show_id: string | null; title: string; start: string; end: string }[];
  skipped: SkippedItem[]; registrableRows: number; registrableEvents: number;
}
export function buildPayload(a: Analysis | null, ea: EventAnalysis | null = null): ImportPayload {
  const shows: ImportPayload["shows"] = []; const skipped: SkippedItem[] = []; let registrable = 0;
  if (!a) a = { rows: [], groups: [], counts: { total: 0, errors: 0, excluded: 0, dups: 0, warnRows: 0, newShows: 0, existingShows: 0, newSessions: 0, existingSessions: 0, newRows: 0, existingRows: 0, assignments: 0 } };
  const reason = (r: AnalyzedRow) => r.status === "error" ? r.errors.join(" / ") : r.status === "excluded" ? "직접 제외한 행" : "같은 파일 안에서 중복된 행(같은 회차·같은 배역·같은 배우)";
  for (const r of a.rows) if (r.status === "error" || r.status === "excluded" || r.status === "dup") skipped.push({ row: r.n, title: r.title, date: r.raw.date, time: r.raw.time, actor: r.raw.actor, reason: reason(r) });
  for (const g of a.groups) {
    const rows = a.rows.filter((r) => g.rowIds.includes(r.id) && (r.status === "new" || r.status === "existing"));
    if (!rows.length) continue;
    registrable += rows.length;
    const sess = new Map<string, { date: string; time: string; cast: Map<string, { role: string; actor: string }> }>();
    for (const r of rows) {
      const s = sess.get(`${r.date} ${r.time}`) ?? { date: r.date, time: r.time, cast: new Map() }; sess.set(`${r.date} ${r.time}`, s);
      for (const c of r.cast) s.cast.set(normKey(c.role), c);
    }
    shows.push({
      key: g.key, title: g.title, mode: g.mode, show_id: g.mode === "existing" ? g.existingId : null, force_new: g.mode === "new" && !!g.existingId,
      venue: g.venue, start: g.start, end: g.end, genre: g.genre, link: g.link,
      sessions: [...sess.values()].sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`)).map((s) => ({ date: s.date, time: s.time, cast: [...s.cast.values()] })),
    });
  }
  const events: ImportPayload["events"] = [];
  if (ea) for (const r of ea.rows) {
    const label = `[이벤트] ${r.show} · ${r.title}`;
    if (r.status === "new" && r.target) events.push({ show_key: r.target.kind === "sheet" ? r.groupKey : null, show_id: r.target.showId, title: r.title, start: r.start, end: r.end });
    else if (r.status === "error") skipped.push({ row: r.n, title: label, date: `${r.raw.start}~${r.raw.end}`, time: "", actor: "", reason: r.errors.join(" / ") });
    else if (r.status === "excluded") skipped.push({ row: r.n, title: label, date: `${r.raw.start}~${r.raw.end}`, time: "", actor: "", reason: "직접 제외한 이벤트 행" });
    else if (r.status === "dup") skipped.push({ row: r.n, title: label, date: evPeriod(r.start, r.end), time: "", actor: "", reason: "같은 파일 안에서 중복된 이벤트(같은 공연·이름·기간)" });
    else if (r.status === "existing") skipped.push({ row: r.n, title: label, date: evPeriod(r.start, r.end), time: "", actor: "", reason: "이미 등록된 이벤트(같은 공연·이름·기간)" });
  }
  return { shows, events, skipped, registrableRows: registrable, registrableEvents: events.length };
}
