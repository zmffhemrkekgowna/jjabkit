import { todayKST } from "./period";

/** 공연 상태는 DB에 저장하지 않고, 개막일·종료일과 '오늘(한국 시간)'로 그때그때 계산해요. 그래서 날짜가 바뀌면 관리자 작업 없이 저절로 바뀌어요. */
export type ShowStatus = "upcoming" | "running" | "ended";
export const STATUS_LABEL: Record<ShowStatus, string> = { upcoming: "개막 예정", running: "공연 중", ended: "공연 종료" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function real(s: string): boolean {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** 개막일·종료일이 상태를 정할 수 있는 값인지 확인해요. 문제가 있으면 안내 문구, 괜찮으면 null. */
export function dateProblem(start: string, end: string): string | null {
  if (!start && !end) return "개막일과 종료일을 입력하면 공연 상태가 자동으로 정해져요.";
  if (!start) return "개막일을 입력해 주세요. 개막일과 종료일이 모두 있어야 상태가 정해져요.";
  if (!end) return "종료일을 입력해 주세요. 개막일과 종료일이 모두 있어야 상태가 정해져요.";
  if (!real(start) || !real(end)) return "날짜 형식이 올바르지 않아요.";
  if (end < start) return "종료일이 개막일보다 빠를 수 없어요.";
  return null;
}

/**
 * 오늘이 개막일 전이면 개막 예정, 개막일~종료일(당일 포함)이면 공연 중, 종료일 다음 날부터는 종료.
 * 날짜가 비었거나 잘못됐으면 짐작하지 않고 null(상태 없음)이에요.
 */
export function statusOf(show: { start: string; end: string }, today: string = todayKST()): ShowStatus | null {
  if (dateProblem(show.start, show.end)) return null;
  if (today < show.start) return "upcoming";
  if (today > show.end) return "ended";
  return "running";
}
