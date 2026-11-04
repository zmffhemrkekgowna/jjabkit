import type { Phase } from "@/types/event";

/** 한국 시간(KST) 기준 오늘 'YYYY-MM-DD'. 서버가 어느 지역에 있어도 같은 날짜가 나와요. */
export const todayKST = (now = Date.now()) => new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 기간 안인지 판단해요. 시작·끝이 비어 있으면 그쪽은 제한 없음. 끝나는 날짜 당일까지 보여요. */
export function phaseOf(p: { startsOn: string; endsOn: string }, today = todayKST()): Phase {
  if (p.startsOn && today < p.startsOn) return "upcoming";
  if (p.endsOn && today > p.endsOn) return "ended";
  return "active";
}

export const PHASE_LABEL: Record<Phase, string> = { upcoming: "예정", active: "진행 중", ended: "종료" };

const dot = (d: string) => d.replace(/-/g, ".");
export function periodText(p: { startsOn: string; endsOn: string }): string {
  if (p.startsOn && p.endsOn) return `${dot(p.startsOn)} ~ ${dot(p.endsOn)}`;
  if (p.startsOn) return `${dot(p.startsOn)} ~`;
  if (p.endsOn) return `~ ${dot(p.endsOn)}`;
  return "기간 제한 없음";
}

/** http(s) 주소만 허용해요. (javascript: 같은 주소가 링크로 들어가는 것을 막아요) */
export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v) && v.length <= 500;
