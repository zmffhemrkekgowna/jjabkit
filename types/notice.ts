export type NoticeKind = "new_show" | "schedule" | "update" | "notice";

export interface Notice {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** 연결된 공연(없으면 ''). 공연이 삭제되면 DB가 자동으로 비워요. */
  showId: string;
  pinned: boolean;
  createdAt: string; // ISO 시각
}

export const KIND_LABEL: Record<NoticeKind, string> = {
  new_show: "신규 공연",
  schedule: "스케줄 변경",
  update: "업데이트",
  notice: "공지",
};
export const KINDS = Object.keys(KIND_LABEL) as NoticeKind[];
