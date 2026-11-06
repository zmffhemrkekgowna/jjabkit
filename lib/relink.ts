/**
 * 공연 데이터를 '전체 교체'로 복원하면 공연·회차의 id가 새로 만들어져요.
 * 그때 이 브라우저에 저장된 하트·내 일정이 끊기지 않도록, 저장할 때 함께 적어 둔 '제목·날짜·시간' 표식으로 새 id를 찾아 이어 붙여요.
 * 표식이 없거나 아직 맞는 회차가 없으면 지우지 않고 그대로 보관해요(나중에 데이터가 돌아오면 다시 이어져요).
 */
export const SESS_META_KEY = "jjabkit-mysched-meta-v1";
export const FAV_META_KEY = "jjabkit-fav-meta-v1";

export const sessionKey = (title: string, date: string, time: string) => `${title}|${date}|${time}`;

export interface ShowRefLite { id: string; title: string; sessions?: { id: string; date: string; time: string }[] }
type Meta = Record<string, string>;

export function readMeta(key: string): Meta {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "{}");
    const out: Meta = {};
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (typeof x === "string") out[k] = x;
    return out;
  } catch { return {}; }
}
export function writeMeta(key: string, m: Meta) { try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* 저장 실패는 무시 */ } }

/** 내 일정 id를 지금 DB 기준으로 맞춰요. 반환: 새 id 목록, 새 표식, 바뀐 게 있는지 */
export function relinkSessionIds(ids: Set<string>, meta: Meta, shows: ShowRefLite[]): { ids: Set<string>; meta: Meta; changed: boolean } {
  const byId = new Map<string, string>(), byKey = new Map<string, string>(), dup = new Set<string>();
  // 제목·날짜·시간이 같은 회차가 둘 이상이면(같은 제목의 다른 공연 등) 어느 쪽인지 알 수 없으니 이어 붙이지 않아요.
  for (const s of shows) for (const x of s.sessions ?? []) { const k = sessionKey(s.title, x.date, x.time); byId.set(x.id, k); if (byKey.has(k)) dup.add(k); else byKey.set(k, x.id); }
  const out = new Set<string>(), nm: Meta = {};
  let changed = false;
  for (const id of ids) {
    const live = byId.get(id);
    if (live) { out.add(id); nm[id] = live; if (meta[id] !== live) changed = true; continue; }
    const k = meta[id];
    const to = k && !dup.has(k) ? byKey.get(k) : undefined;
    if (to && !ids.has(to)) { out.add(to); nm[to] = k!; changed = true; continue; } // 새 id로 이어 붙임(모호하거나 이미 쓰는 id면 안 붙여요)
    if (k) { out.add(id); nm[id] = k; continue; } // 지금은 없지만 표식이 있어 보관
    changed = true; // 표식도 없고 맞는 회차도 없는 id: 예전처럼 정리
  }
  if (out.size !== ids.size) changed = true;
  return { ids: out, meta: nm, changed };
}

/** 관심 공연 id를 같은 방식으로 맞춰요(공연 제목으로). */
export function relinkShowIds(ids: Set<string>, meta: Meta, shows: { id: string; title: string }[]): { ids: Set<string>; meta: Meta; changed: boolean } {
  const byId = new Map(shows.map((s) => [s.id, s.title])), byTitle = new Map<string, string>(), dupT = new Set<string>();
  for (const s of shows) { if (byTitle.has(s.title)) dupT.add(s.title); else byTitle.set(s.title, s.id); }
  const out = new Set<string>(), nm: Meta = {};
  let changed = false;
  for (const id of ids) {
    const t = byId.get(id);
    if (t !== undefined) { out.add(id); nm[id] = t; if (meta[id] !== t) changed = true; continue; }
    const k = meta[id], to = k && !dupT.has(k) ? byTitle.get(k) : undefined;
    if (to && !ids.has(to)) { out.add(to); nm[to] = k!; changed = true; continue; }
    if (k) { out.add(id); nm[id] = k; continue; }
    changed = true;
  }
  if (out.size !== ids.size) changed = true;
  return { ids: out, meta: nm, changed };
}
