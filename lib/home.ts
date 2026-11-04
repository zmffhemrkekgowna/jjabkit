import type { Session, Show } from "@/types/show";
import { fromKey } from "./casting";
import { todayKST } from "./period";

export const nowKST = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

export interface NextMine { show: Show; session: Session; days: number; extra: number }
/** 내 일정 중 지금 이후 가장 가까운 회차 하나와, 그 뒤로 남은 일정 수 */
export function nextMine(shows: Show[], ids: Set<string>, now = Date.now()): NextMine | null {
  const cur = nowKST(now), today = todayKST(now);
  const list: { show: Show; session: Session }[] = [];
  for (const show of shows) for (const session of show.sessions) if (ids.has(session.id) && `${session.date} ${session.time}` >= cur) list.push({ show, session });
  if (list.length === 0) return null;
  list.sort((a, b) => (a.session.date + a.session.time + a.show.title).localeCompare(b.session.date + b.session.time + b.show.title));
  const f = list[0];
  const days = Math.round((fromKey(f.session.date).getTime() - fromKey(today).getTime()) / 86400e3);
  return { ...f, days, extra: list.length - 1 };
}
export const ddayText = (days: number) => (days <= 0 ? "오늘" : `D-${days}`);
