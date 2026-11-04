import type { Session } from "@/types/show";

const hhmm = (t: string) => t.slice(0, 5);
const keyOf = (s: Pick<Session, "date" | "time">) => `${s.date} ${hhmm(s.time)}`;

/**
 * 선택한 회차의 시간을 한꺼번에 바꾸는 계획.
 * 같은 공연·같은 날짜·같은 시간의 회차는 둘 수 없어서(DB 규칙), 겹치는 회차는 바꾸지 않고 skipped에 담아요.
 * ok: 바꿀 회차 / skipped: 겹쳐서 못 바꾸는 회차 / same: 이미 그 시간이라 그대로인 회차
 */
export function planTimeChange(selected: Session[], all: Session[], time: string) {
  const sel = new Set(selected.map((s) => s.id));
  const taken = new Set(all.filter((s) => !sel.has(s.id)).map(keyOf));
  const ok: Session[] = [], skipped: Session[] = [], same: Session[] = [];
  // 이미 그 시간인 선택 회차도 자리를 차지하고 있어서, 다른 회차가 그 자리로 옮겨 가면 겹쳐요.
  for (const s of selected) if (hhmm(s.time) === time) taken.add(keyOf(s));
  for (const s of [...selected].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))) {
    if (hhmm(s.time) === time) { same.push(s); continue; }
    const k = `${s.date} ${time}`;
    if (taken.has(k)) { skipped.push(s); continue; }
    taken.add(k); ok.push(s);
  }
  return { ok, skipped, same };
}

/** 회차 목록을 날짜·시간순으로 */
export const bySlot = (a: Pick<Session, "date" | "time">, b: Pick<Session, "date" | "time">) => keyOf(a).localeCompare(keyOf(b));
