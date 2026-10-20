import type { Show } from "@/types/show";
import type { ShowIndex } from "./casting";

export type EventIcon = "clock" | "cap" | "star" | "pct" | "heart" | "users";
export interface EventCard {
  id: string; icon: EventIcon; type: string; rate: string; title: string; desc: string;
  period: string; cond: string[]; dates?: string[];
}

/** 할인 & 이벤트 탭의 카드. 커튼콜·타임세일은 등록된 회차 체크 상태에서 계산해요. */
export function buildEvents(show: Show, idx: ShowIndex): EventCard[] {
  return [
    { id: "early", icon: "clock", type: "조기예매 할인", rate: "30%", title: "오픈 기념 조기예매 특가", desc: "기간 내 예매 시 전 회차 R석·S석을 할인해요.", period: show.eb || "조기예매 기간 미정", cond: ["1인 최대 4매", "R석·S석"] },
    { id: "youth", icon: "cap", type: "청소년 할인", rate: "25%", title: "청소년·대학생 할인", desc: "만 24세 이하 관객은 현장에서 학생증을 보여주면 할인돼요.", period: "전 회차 상시", cond: ["학생증 지참", "본인 1매"] },
    { id: "curtain", icon: "star", type: "커튼콜 데이", rate: `${idx.curtainDates.length}회`, title: "커튼콜 촬영 허용 공연", desc: "마지막 커튼콜에 한해 사진·영상 촬영이 허용돼요.", period: `커튼콜 데이 ${idx.curtainDates.length}회차`, cond: ["플래시 금지", "개인 소장용"], dates: idx.curtainDates },
    { id: "timesale", icon: "pct", type: "타임세일", rate: "20%", title: "수요일 오후 2시 타임세일", desc: "다음 날 이후 회차의 잔여석을 한정 수량으로 할인해요.", period: `타임세일 적용 ${idx.timesaleCount}회차`, cond: ["잔여석 한정", "예매처 공통"] },
    { id: "official", icon: "heart", type: "제작사 이벤트", rate: "굿즈", title: "관람 인증 포토카드 증정", desc: "관람 후 SNS 인증글을 올리면 추첨으로 포토카드를 드려요.", period: show.end ? `~ ${show.end.replace(/-/g, ".")}` : "기간 미정", cond: ["추첨 100명", "비공개 계정 제외"] },
    { id: "group", icon: "users", type: "단체 할인", rate: "40%", title: "10인 이상 단체 관람", desc: "10인 이상 단체는 제작사 문의 후 별도 가격으로 예매할 수 있어요.", period: "공연 3일 전까지 신청", cond: ["10인 이상", "전화 접수"] },
  ];
}
