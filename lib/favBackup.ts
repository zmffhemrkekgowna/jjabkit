/**
 * '내 하트' 백업(JSON). 하트는 이 브라우저(localStorage)에만 있어서, 브라우저를 바꾸거나 사이트 데이터를 지우면 사라져요.
 * 공연은 id와 제목을 함께 담아, 공연 데이터를 다시 만들어 id가 바뀌었어도 제목으로 찾아 맞춰요.
 */
export const FAV_KIND = "favorites";
export const FAV_VERSION = 1;
export const FAV_MAX_BYTES = 1024 * 1024;
const MAX_ITEMS = 500;

export interface FavBackupFile { app: "myukit"; kind: typeof FAV_KIND; version: number; exportedAt: string; shows: { id: string; title: string }[]; actors: string[] }
interface ShowRef { id: string; title: string }

export function buildFavBackup(shows: ShowRef[], favShows: Set<string>, favActors: Set<string>, now = new Date()): FavBackupFile {
  return {
    app: "myukit", kind: FAV_KIND, version: FAV_VERSION, exportedAt: now.toISOString(),
    shows: shows.filter((s) => favShows.has(s.id)).map((s) => ({ id: s.id, title: s.title })),
    actors: [...favActors],
  };
}
export const favBackupFileName = (now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `myukit-hearts-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
};

export type FavParse =
  | { ok: true; showIds: string[]; unmatched: string[]; actors: string[]; exportedAt: string }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 파일을 검사하고, 지금 DB에 있는 공연(known)과 맞춰 봐요. 없는 공연은 unmatched에 제목만 담아요. */
export function parseFavBackup(text: string, known: ShowRef[]): FavParse {
  if (text.length > FAV_MAX_BYTES) return { ok: false, error: "파일이 너무 커요." };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "JSON 형식이 아니에요. 뮤킷에서 내려받은 하트 백업 파일이 맞는지 확인해 주세요." }; }
  if (!isObj(raw) || raw.app !== "myukit") return { ok: false, error: "뮤킷 백업 파일이 아니에요." };
  if (raw.kind !== FAV_KIND) return { ok: false, error: "이 파일은 하트 백업이 아니에요. (공연 데이터 백업은 관리자 화면에서 불러와요)" };
  if (raw.version !== FAV_VERSION) return { ok: false, error: `지원하지 않는 버전이에요. (파일 버전: ${String(raw.version)})` };
  if (!Array.isArray(raw.shows) || !Array.isArray(raw.actors)) return { ok: false, error: "관심 공연·관심 배우 목록이 없어요." };
  if (raw.shows.length > MAX_ITEMS || raw.actors.length > MAX_ITEMS) return { ok: false, error: `항목이 너무 많아요. (각각 ${MAX_ITEMS}개까지)` };

  const byId = new Map(known.map((s) => [s.id, s.id]));
  const byTitle = new Map(known.map((s) => [s.title, s.id]));
  const showIds = new Set<string>(), unmatched: string[] = [];
  for (const s of raw.shows) {
    if (!isObj(s) || typeof s.id !== "string" || typeof s.title !== "string" || s.title.length > 200) return { ok: false, error: "관심 공연 항목의 형식이 잘못됐어요." };
    const id = byId.get(s.id) ?? byTitle.get(s.title);
    if (id) showIds.add(id); else unmatched.push(s.title);
  }
  const actors = new Set<string>();
  for (const a of raw.actors) {
    if (typeof a !== "string" || a.length > 50) return { ok: false, error: "관심 배우 항목의 형식이 잘못됐어요." };
    const n = a.trim();
    if (n) actors.add(n);
  }
  return { ok: true, showIds: [...showIds], unmatched, actors: [...actors], exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "" };
}
