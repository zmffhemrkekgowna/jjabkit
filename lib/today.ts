import type { Session, Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { addDays, fromKey, toKey } from "./casting";
import { eventsForDate } from "./eventScope";

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** 'YYYY-MM-DD' 모양이면서 실제로 있는 날짜인지 */
export const validDate = (v: unknown): v is string => typeof v === "string" && DATE_KEY.test(v) && toKey(fromKey(v)) === v;
export const shiftDate = (k: string, n: number) => toKey(addDays(fromKey(k), n));

export const NO_CAST = "캐스트 정보 없음";

/** 이 회차에 실제로 연결된 배우를 배역 순서대로. 정해진 배우가 없으면 빈 목록이에요. */
export function castNames(show: Show, s: Session): string[] {
  const out: string[] = [];
  for (const r of show.roles) {
    const id = s.cast[r.id];
    const a = id ? r.actors.find((x) => x.id === id) : undefined;
    if (a) out.push(a.n);
  }
  return out;
}
export const castText = (show: Show, s: Session) => { const n = castNames(show, s); return n.length ? n.join(" · ") : NO_CAST; };

export interface TodayGroup { show: Show; sessions: Session[] }
/** 그 날짜에 회차가 있는 공연만, 회차는 시간순. 공연은 가장 이른 회차 시간 → 제목 순이에요. */
export function groupByDate(shows: Show[], date: string): TodayGroup[] {
  return shows
    .map((show) => ({ show, sessions: show.sessions.filter((s) => s.date === date).sort((a, b) => a.time.localeCompare(b.time)) }))
    .filter((g) => g.sessions.length > 0)
    .sort((a, b) => a.sessions[0].time.localeCompare(b.sessions[0].time) || a.show.title.localeCompare(b.show.title, "ko"));
}

/**
 * 그 공연·그 날짜에 적용되는 이벤트. 이벤트는 '회차'가 아니라 공연+기간(시작일~종료일)에 연결돼 있어요(events 표).
 * - 다른 공연의 이벤트, 시작일이 없는 이벤트(적용 범위를 알 수 없음)는 넣지 않아요.
 * - 종료일이 비어 있으면 시작일 하루짜리예요. (달력 막대·공연 상세와 같은 규칙)
 */
export function eventsOnDate(events: EventItem[], showId: string, date: string): EventItem[] {
  return eventsForDate(events, showId, date);
}

export interface TimeSlot { time: string; rows: { show: Show; session: Session }[] }
/** 같은 시작 시간의 회차를 한 묶음으로(시간순), 묶음 안에서는 공연 제목 순이에요. 극이 많아도 시간대별로 한눈에 보이게 해요. */
export function groupByTime(groups: TodayGroup[]): TimeSlot[] {
  const m = new Map<string, TimeSlot["rows"]>();
  for (const { show, sessions } of groups) for (const session of sessions) m.set(session.time, [...(m.get(session.time) ?? []), { show, session }]);
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, rows]) => ({ time, rows: rows.sort((a, b) => a.show.title.localeCompare(b.show.title, "ko") || a.show.id.localeCompare(b.show.id)) }));
}
