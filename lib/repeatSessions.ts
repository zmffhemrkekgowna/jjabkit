import { addDays, fromKey, toKey } from "./casting";

export const MAX_REPEAT_SESSIONS = 200;
export const MAX_REPEAT_DAYS = 366;

export interface RepeatPlan {
  /** 만들어질 날짜들(이미 있는 날짜·시간은 제외) */
  dates: string[];
  /** 이미 같은 날짜·시간의 회차가 있어서 건너뛰는 날짜들 */
  skipped: string[];
  /** 입력이 잘못됐을 때 안내 문구 (없으면 빈 문자열) */
  problem: string;
}

/** 시작일~종료일(양 끝 포함) 중 선택한 요일(0=일 … 6=토)에 해당하는 날짜를 모아요. */
export function repeatDates(start: string, end: string, weekdays: number[]): string[] {
  if (!start || !end || end < start || weekdays.length === 0) return [];
  const set = new Set(weekdays);
  const out: string[] = [];
  const last = fromKey(end);
  for (let d = fromKey(start); d <= last; d = addDays(d, 1)) if (set.has(d.getDay())) out.push(toKey(d));
  return out;
}

/** 입력값을 검사하고, 만들 회차와 건너뛸 회차를 나눠요. existing은 이미 등록된 "날짜 시간" 목록이에요. */
export function planRepeat(start: string, end: string, weekdays: number[], time: string, existing: Iterable<string>): RepeatPlan {
  const fail = (problem: string): RepeatPlan => ({ dates: [], skipped: [], problem });
  if (!start || !end) return fail("시작일과 종료일을 골라 주세요.");
  if (end < start) return fail("종료일이 시작일보다 빠를 수 없어요.");
  const days = (fromKey(end).getTime() - fromKey(start).getTime()) / 86400000 + 1;
  if (days > MAX_REPEAT_DAYS) return fail(`한 번에 ${MAX_REPEAT_DAYS}일까지만 만들 수 있어요. 기간을 나눠 주세요.`);
  if (weekdays.length === 0) return fail("요일을 하나 이상 골라 주세요.");
  if (!time) return fail("회차 시간을 입력해 주세요.");
  const have = new Set(existing);
  const all = repeatDates(start, end, weekdays);
  const dates = all.filter((d) => !have.has(`${d} ${time}`));
  const skipped = all.filter((d) => have.has(`${d} ${time}`));
  if (dates.length > MAX_REPEAT_SESSIONS) return fail(`한 번에 ${MAX_REPEAT_SESSIONS}개까지만 만들 수 있어요. 기간을 나눠 주세요.`);
  if (all.length === 0) return fail("선택한 기간에 해당하는 요일이 없어요.");
  return { dates, skipped, problem: "" };
}
