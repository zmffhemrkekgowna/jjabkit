import type { Session, Show } from "@/types/show";

export interface MyItem { show: Show; session: Session; hit: string[] }
export interface Appearance { show: Show; roleName: string; count: number }

/** 공연 대표색(포스터 그라데이션의 가운데 색). 달력 태그 왼쪽 띠에 써서 공연을 구분해요. */
export const showColor = (s: Pick<Show, "grad">) => s.grad.split(",")[1] ?? "#888";

/** 관심 배우(names) 중 한 명이라도 출연하는 모든 공연의 회차를 날짜순으로 모아요. */
export function buildMySchedule(shows: Show[], names: Set<string>): MyItem[] {
  const items: MyItem[] = [];
  for (const show of shows) {
    const nameOf = new Map<string, string>();
    show.roles.forEach((r) => r.actors.forEach((a) => nameOf.set(a.id, a.n)));
    for (const session of show.sessions) {
      const hit = show.roles
        .map((r) => nameOf.get(session.cast[r.id]))
        .filter((n): n is string => !!n && names.has(n));
      if (hit.length > 0) items.push({ show, session, hit });
    }
  }
  return items.sort((a, b) =>
    (a.session.date + a.session.time + a.show.title).localeCompare(b.session.date + b.session.time + b.show.title));
}

/** 배우 한 명(이름)이 출연하는 공연·배역과 회차 수 */
export function appearancesOf(shows: Show[], name: string): Appearance[] {
  return shows.flatMap((show) =>
    show.roles.flatMap((r) =>
      r.actors.filter((a) => a.n === name).map((a) => ({
        show, roleName: r.name, count: show.sessions.filter((s) => s.cast[r.id] === a.id).length,
      }))));
}
