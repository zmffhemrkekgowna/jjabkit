import { cleanRecordsDetailed, type WatchedRecord } from "./watched";
/**
 * '내 하트' 백업(JSON). 하트는 이 브라우저(localStorage)에만 있어서, 브라우저를 바꾸거나 사이트 데이터를 지우면 사라져요.
 * 공연은 id와 제목을 함께 담아, 공연 데이터를 다시 만들어 id가 바뀌었어도 제목으로 찾아 맞춰요.
 */
export const FAV_KIND = "favorites";
export const FAV_VERSION = 1;
export const FAV_MAX_BYTES = 1024 * 1024;
const MAX_ITEMS = 500;
const MAX_SESSIONS = 2000;

export interface MyBackupSession { id: string; show: string; date: string; time: string }
export interface FavBackupFile { app: "jjabkit"; kind: typeof FAV_KIND; version: number; exportedAt: string; shows: { id: string; title: string }[]; actors: string[]; /** 내 일정(없으면 예전 파일) */ mySessions?: MyBackupSession[]; /** 관극 완료 기록(없으면 예전 파일) */ watched?: WatchedRecord[] }
interface SessionRef { id: string; date: string; time: string }
interface ShowRef { id: string; title: string; sessions?: SessionRef[] }

export function buildFavBackup(shows: ShowRef[], favShows: Set<string>, favActors: Set<string>, now = new Date(), mine: Set<string> = new Set(), watched: WatchedRecord[] = []): FavBackupFile {
  // 내 일정은 회차 id와 함께 공연 제목·날짜·시간을 담아요. 데이터를 다시 만들어 id가 바뀌어도 이 셋으로 찾아 맞춰요.
  const mySessions: MyBackupSession[] = shows.flatMap((s) => (s.sessions ?? []).filter((x) => mine.has(x.id)).map((x) => ({ id: x.id, show: s.title, date: x.date, time: x.time })))
    .sort((a, b) => (a.date + a.time + a.show).localeCompare(b.date + b.time + b.show));
  return {
    app: "jjabkit", kind: FAV_KIND, version: FAV_VERSION, exportedAt: now.toISOString(),
    shows: shows.filter((s) => favShows.has(s.id)).map((s) => ({ id: s.id, title: s.title })),
    actors: [...favActors],
    mySessions,
    watched,
  };
}
export const favBackupFileName = (now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `jjabkit-hearts-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
};

export type FavParse =
  | { ok: true; showIds: string[]; unmatched: string[]; actors: string[]; exportedAt: string; /** null이면 내 일정이 없는 예전 파일 */ sessionIds: string[] | null; unmatchedSessions: number; /** null이면 관극 기록이 없는 예전 파일 */ watched: WatchedRecord[] | null; /** 날짜·시간 등이 잘못돼 제외한 관극 기록 */ watchedRejected: { index: number; reason: string }[]; /** 제목이 같은 공연이 여럿이라 어느 쪽인지 몰라 연결하지 않은 항목 수 */ ambiguous: number }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 파일을 검사하고, 지금 DB에 있는 공연(known)과 맞춰 봐요. 없는 공연은 unmatched에 제목만 담아요. */
export function parseFavBackup(text: string, known: ShowRef[]): FavParse {
  if (text.length > FAV_MAX_BYTES) return { ok: false, error: "파일이 너무 커요." };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "JSON 형식이 아니에요. JJabKit에서 내려받은 하트 백업 파일이 맞는지 확인해 주세요." }; }
  if (!isObj(raw) || raw.app !== "jjabkit" && raw.app !== "myukit") return { ok: false, error: "JJabKit 백업 파일이 아니에요." };
  if (raw.kind !== FAV_KIND) return { ok: false, error: "이 파일은 하트 백업이 아니에요. (공연 데이터 백업은 관리자 화면에서 불러와요)" };
  if (raw.version !== FAV_VERSION) return { ok: false, error: `지원하지 않는 버전이에요. (파일 버전: ${String(raw.version)})` };
  if (!Array.isArray(raw.shows) || !Array.isArray(raw.actors)) return { ok: false, error: "관심 공연·관심 배우 목록이 없어요." };
  if (raw.shows.length > MAX_ITEMS || raw.actors.length > MAX_ITEMS) return { ok: false, error: `항목이 너무 많아요. (각각 ${MAX_ITEMS}개까지)` };

  const byId = new Map(known.map((s) => [s.id, s.id]));
  const byTitle = new Map<string, string>(), dupTitle = new Set<string>();
  for (const s of known) { if (byTitle.has(s.title)) dupTitle.add(s.title); else byTitle.set(s.title, s.id); }
  let ambiguous = 0;
  const showIds = new Set<string>(), unmatched: string[] = [];
  for (const s of raw.shows) {
    if (!isObj(s) || typeof s.id !== "string" || typeof s.title !== "string" || s.title.length > 200) return { ok: false, error: "관심 공연 항목의 형식이 잘못됐어요." };
    let id = byId.get(s.id);
    if (!id && dupTitle.has(s.title)) { ambiguous++; unmatched.push(s.title); continue; } // 같은 제목의 공연이 여럿이면 임의로 고르지 않아요
    id = id ?? byTitle.get(s.title);
    if (id) showIds.add(id); else unmatched.push(s.title);
  }
  const actors = new Set<string>();
  for (const a of raw.actors) {
    if (typeof a !== "string" || a.length > 50) return { ok: false, error: "관심 배우 항목의 형식이 잘못됐어요." };
    const n = a.trim();
    if (n) actors.add(n);
  }
  let sessionIds: string[] | null = null, unmatchedSessions = 0;
  if (raw.mySessions !== undefined) {
    if (!Array.isArray(raw.mySessions)) return { ok: false, error: "내 일정 항목의 형식이 잘못됐어요." };
    if (raw.mySessions.length > MAX_SESSIONS) return { ok: false, error: `내 일정이 너무 많아요. (${MAX_SESSIONS}개까지)` };
    const knownId = new Set<string>(), byKey = new Map<string, string>(), dupKey = new Set<string>();
    for (const s of known) for (const x of s.sessions ?? []) { knownId.add(x.id); const k = `${s.title}|${x.date}|${x.time}`; if (byKey.has(k)) dupKey.add(k); else byKey.set(k, x.id); }
    const ids = new Set<string>();
    for (const m of raw.mySessions) {
      if (!isObj(m) || typeof m.id !== "string" || typeof m.show !== "string" || typeof m.date !== "string" || typeof m.time !== "string" || m.show.length > 200 || m.date.length > 10 || m.time.length > 5) return { ok: false, error: "내 일정 항목의 형식이 잘못됐어요." };
      const key = `${m.show}|${m.date}|${m.time}`;
      if (!knownId.has(m.id) && dupKey.has(key)) { ambiguous++; unmatchedSessions++; continue; } // 제목·날짜·시간이 같은 회차가 여럿이면 연결하지 않아요
      const id = knownId.has(m.id) ? m.id : byKey.get(key);
      if (id) ids.add(id); else unmatchedSessions++;
    }
    sessionIds = [...ids];
  }
  let watched: WatchedRecord[] | null = null, watchedRejected: { index: number; reason: string }[] = [];
  if (raw.watched !== undefined) {
    if (!Array.isArray(raw.watched)) return { ok: false, error: "관극 완료 기록의 형식이 잘못됐어요." };
    if (raw.watched.length > 5000) return { ok: false, error: "관극 완료 기록이 너무 많아요. (5000개까지)" };
    // 항목별로 검사해서 잘못된 것만 빼요. 파일 전체를 거부하지 않아요(정상 항목은 그대로 불러와요).
    const r = cleanRecordsDetailed(raw.watched);
    watched = r.records; watchedRejected = r.rejected;
  }
  return { ok: true, showIds: [...showIds], unmatched, actors: [...actors], exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "", sessionIds, unmatchedSessions, watched, watchedRejected, ambiguous };
}
