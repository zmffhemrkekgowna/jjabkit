export interface EventItem {
  id: string;
  title: string;
  /** 'YYYY-MM-DD' (달력 막대의 시작). 끝나는 날이 비어 있으면 하루짜리예요. */
  startsOn: string;
  endsOn: string;
  /** 공지 링크(http/https). 없으면 '' */
  linkUrl: string;
  /** 이 이벤트가 속한 공연. 이벤트는 공연의 '공연 관리' 화면에서만 만들어요. */
  showId: string;
  /** 달력 막대 색 '#rrggbb' (없으면 '' = 기본색) */
  color: string;
  createdAt: string;
  /**
   * 적용 범위. all: 공연의 모든 회차 · range: 시작일~종료일 사이의 회차(기존 이벤트는 모두 이것) · sessions: sessionKeys에 든 회차만.
   * 0011을 아직 안 돌린 DB에서는 항상 range예요.
   */
  scope: EventScope;
  /** scope가 sessions일 때 고른 회차: "YYYY-MM-DD HH:MM" (날짜+시작 시간). 아니면 [] */
  sessionKeys: string[];
}
export type EventScope = "all" | "range" | "sessions";

export type Phase = "upcoming" | "active" | "ended";
