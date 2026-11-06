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

/** 'YYYY-MM-DD'가 달력에 실제로 있는 날짜인지(2026-02-30 같은 값을 걸러요). 비어 있으면 false. */
export function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * 새로 입력하는 공지 링크 검사(저장 직전용). 비어 있으면 통과.
 * 이미 저장된 링크를 보여 줄 때는 예전 기준(isHttpUrl)을 그대로 써서 기존 데이터가 갑자기 사라지지 않게 해요.
 */
export function linkProblem(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/\s/.test(v)) return "링크에 공백이 들어 있어요.";
  if (!/^https?:\/\//i.test(v)) return "공지 링크는 http:// 또는 https:// 로 시작해야 해요.";
  let u: URL;
  try { u = new URL(v); } catch { return "올바른 주소가 아니에요. 주소를 통째로 복사해서 붙여넣어 주세요."; }
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return "올바른 주소가 아니에요. (예: https://example.com/notice)";
  if (v.length > 500) return "링크가 너무 길어요. (500자 이내)";
  return "";
}
