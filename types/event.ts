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
}

export type Phase = "upcoming" | "active" | "ended";
