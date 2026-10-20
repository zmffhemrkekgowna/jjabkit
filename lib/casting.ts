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

export const SITES = [
  ["인터파크", "https://tickets.interpark.com"],
  ["YES24", "https://ticket.yes24.com"],
  ["멜론티켓", "https://ticket.melon.com"],
] as const;

export interface ActorInfo { id: string; n: string; roleId: string }
const UNKNOWN: ActorInfo = { id: "", n: "미정", roleId: "" };

export interface ShowIndex {
  roles: Role[];
  sessions: Session[];
  byDate: Map<string, Session[]>;
  actors: Map<string, ActorInfo>;
  start: Date;
  end: Date;
  curtainDates: string[];
  timesaleCount: number;
}

/** 공연 데이터를 화면에서 쓰기 좋게 한 번만 가공해요. */
export function buildIndex(show: Show): ShowIndex {
  const actors = new Map<string, ActorInfo>();
  show.roles.forEach((r) => r.actors.forEach((a) => actors.set(a.id, { id: a.id, n: a.n, roleId: r.id })));
  const sessions = [...show.sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const byDate = new Map<string, Session[]>();
  sessions.forEach((s) => { const l = byDate.get(s.date) ?? []; l.push(s); byDate.set(s.date, l); });
  const ds = [show.start, show.end, ...sessions.map((s) => s.date)].filter(Boolean).sort();
  const first = ds[0] ?? "2026-01-01";
  return {
    roles: show.roles, sessions, byDate, actors,
    start: fromKey(first), end: fromKey(ds[ds.length - 1] ?? first),
    curtainDates: [...new Set(sessions.filter((s) => s.curtain).map((s) => s.date))],
    timesaleCount: sessions.filter((s) => s.timesale).length,
  };
}

export const actorOf = (idx: ShowIndex, id: string | undefined): ActorInfo => (id && idx.actors.get(id)) || UNKNOWN;

/**
 * 선택한 배우 필터. 다른 배역의 배우끼리는 AND(모두 출연), 같은 배역 안에서는 OR
 * (한 회차에 한 배역은 배우 한 명만 서기 때문이에요).
 */
export function matches(idx: ShowIndex, s: Session, sel: Set<string>): boolean {
  const by = new Map<string, string[]>();
  sel.forEach((id) => { const a = idx.actors.get(id); if (a) by.set(a.roleId, [...(by.get(a.roleId) ?? []), id]); });
  if (by.size === 0) return true;
  return [...by].every(([roleId, ids]) => ids.includes(s.cast[roleId]));
}

export function visibleOn(idx: ShowIndex, dateKey: string, sel: Set<string>, only: boolean): Session[] {
  const all = idx.byDate.get(dateKey) ?? [];
  return only && sel.size > 0 ? all.filter((s) => matches(idx, s, sel)) : all;
}
