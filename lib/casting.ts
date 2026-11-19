import type { Role, Session, Show } from "@/types/show";

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 'YYYY-MM-DD' -> 로컬 자정 (new Date('YYYY-MM-DD')는 UTC로 읽혀 하루가 밀릴 수 있어요) */
export const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const weekStart = (d: Date) => addDays(d, -d.getDay());
export const fmtDate = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
const dots = (t: string) => t.replace(/-/g, ".");
export const period = (s: Pick<Show, "start" | "end">) =>
  `${s.start ? dots(s.start) : "미정"} ~ ${s.end ? dots(s.end.slice(5)) : "미정"}`;

const POOL_ID = "__pool";
type CastMemberLite = Role["actors"][number];
export interface ActorInfo { id: string; n: string; roleId: string }
const UNKNOWN: ActorInfo = { id: "", n: "미정", roleId: "" };

export interface ShowIndex {
  /** 콘서트면 true. 콘서트의 '배역'은 출연 슬롯(출연진 1·2…)이라 사용자 화면에서는 이름을 숨기고 배우 이름만 보여줘요. */
  concert: boolean;
  /** 배우 필터에 쓰는 묶음. 연극·뮤지컬은 roles 그대로, 콘서트는 슬롯마다 같은 이름이 반복되지 않게 '출연진' 하나로 합쳐요. */
  filterRoles: Role[];
  /** (콘서트) 슬롯마다 따로 있는 같은 이름의 배우 id → 대표 id. 연극·뮤지컬은 비어 있어요. */
  alias: Map<string, string>;
  roles: Role[];
  sessions: Session[];
  byDate: Map<string, Session[]>;
  actors: Map<string, ActorInfo>;
  start: Date;
  end: Date;
  curtainDates: string[];
}

/** 공연 데이터를 화면에서 쓰기 좋게 한 번만 가공해요. */
export function buildIndex(show: Show): ShowIndex {
  const concert = show.genre === "콘서트";
  const actors = new Map<string, ActorInfo>();
  const alias = new Map<string, string>();
  let filterRoles: Role[] = show.roles;
  if (concert) {
    const byName = new Map<string, string>(); // 이름 → 대표 id (같은 사람이 여러 슬롯 후보에 있어도 한 명으로 세요)
    const pool: CastMemberLite[] = [];
    show.roles.forEach((r) => r.actors.forEach((a) => {
      const key = a.n.trim();
      const rep = byName.get(key);
      if (rep) { alias.set(a.id, rep); return; }
      byName.set(key, a.id); pool.push(a); actors.set(a.id, { id: a.id, n: a.n, roleId: POOL_ID });
    }));
    filterRoles = pool.length ? [{ id: POOL_ID, name: "출연진", short: "", actors: pool }] : [];
  } else {
    show.roles.forEach((r) => r.actors.forEach((a) => actors.set(a.id, { id: a.id, n: a.n, roleId: r.id })));
  }
  const sessions = [...show.sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const byDate = new Map<string, Session[]>();
  sessions.forEach((s) => { const l = byDate.get(s.date) ?? []; l.push(s); byDate.set(s.date, l); });
  const ds = [show.start, show.end, ...sessions.map((s) => s.date)].filter(Boolean).sort();
  const first = ds[0] ?? "2026-01-01";
  return {
    concert, filterRoles, alias, roles: show.roles, sessions, byDate, actors,
    start: fromKey(first), end: fromKey(ds[ds.length - 1] ?? first),
    curtainDates: [...new Set(sessions.filter((s) => s.curtain).map((s) => s.date))],
  };
}

export const actorOf = (idx: ShowIndex, id: string | undefined): ActorInfo => (id && (idx.actors.get(id) ?? idx.actors.get(idx.alias.get(id) ?? ""))) || UNKNOWN;

/** 회차의 출연진 한 줄. 연극·뮤지컬은 배역마다 한 줄(미정 포함, 예전과 같아요). 콘서트는 정해진 출연자만, 슬롯 이름 없이 한 명씩 나와요. */
export interface CastRow { key: string; role: Role | null; a: ActorInfo }
export function castRows(idx: ShowIndex, s: Session): CastRow[] {
  if (!idx.concert) return idx.roles.map((r) => ({ key: r.id, role: r, a: actorOf(idx, s.cast[r.id]) }));
  const seen = new Set<string>();
  const out: CastRow[] = [];
  for (const r of idx.roles) {
    const a = actorOf(idx, s.cast[r.id]);
    if (!a.id || seen.has(a.id)) continue;
    seen.add(a.id); out.push({ key: r.id, role: null, a });
  }
  return out;
}
/** 필터에 쓰는 배우 id를 대표 id로 맞춰요(콘서트에서 같은 사람이 슬롯마다 따로 있어도 한 명으로 봐요). */
export const canonSel = (idx: ShowIndex, sel: Set<string>): Set<string> => idx.alias.size ? new Set([...sel].map((id) => idx.alias.get(id) ?? id)) : sel;

/**
 * 선택한 배우 필터. 다른 배역의 배우끼리는 AND(모두 출연), 같은 배역 안에서는 OR
 * (한 회차에 한 배역은 배우 한 명만 서기 때문이에요).
 */
export function matches(idx: ShowIndex, s: Session, sel: Set<string>): boolean {
  if (idx.concert) { // 콘서트: 고른 배우가 모두 그 회차에 서는 회차
    const want = [...canonSel(idx, sel)].filter((id) => idx.actors.has(id));
    if (want.length === 0) return true;
    const have = new Set(castRows(idx, s).map((x) => x.a.id));
    return want.every((id) => have.has(id));
  }
  const by = new Map<string, string[]>();
  sel.forEach((id) => { const a = idx.actors.get(id); if (a) by.set(a.roleId, [...(by.get(a.roleId) ?? []), id]); });
  if (by.size === 0) return true;
  return [...by].every(([roleId, ids]) => ids.includes(s.cast[roleId]));
}

export function visibleOn(idx: ShowIndex, dateKey: string, sel: Set<string>, only: boolean): Session[] {
  const all = idx.byDate.get(dateKey) ?? [];
  return sel.size > 0 ? all.filter((s) => matches(idx, s, sel)) : all;
}

/** 필터를 반영한 회차 목록(날짜·시간순). */
const filtered = (idx: ShowIndex, sel: Set<string>) => idx.sessions.filter((s) => matches(idx, s, sel));

/** 지금(KST, 'YYYY-MM-DD HH:mm') 이후 가장 가까운 회차. 필터가 있으면 조건에 맞는 회차만 봐요. 없으면 null. */
export function nextSession(idx: ShowIndex, nowKst: string, sel: Set<string>): Session | null {
  return filtered(idx, sel).find((s) => `${s.date} ${s.time}` >= nowKst) ?? null;
}
export const firstSession = (idx: ShowIndex, sel: Set<string>): Session | null => filtered(idx, sel)[0] ?? null;
export const lastSession = (idx: ShowIndex, sel: Set<string>): Session | null => { const l = filtered(idx, sel); return l[l.length - 1] ?? null; };
