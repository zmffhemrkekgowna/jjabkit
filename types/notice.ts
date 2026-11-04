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

/** 관리자 화면에서 새로 올리고 관리할 수 있는 종류. 스케줄 변경·업데이트는 더 이상 쓰지 않아요.
 *  (이미 올라간 옛 소식이 사용자 화면에서 이름을 잃지 않도록 KIND_LABEL과 DB의 허용 값은 그대로 둬요.) */
export const ADMIN_KINDS: NoticeKind[] = ["new_show", "notice"];
