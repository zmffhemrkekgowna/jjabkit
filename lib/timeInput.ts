/** 24시간제 시간 입력 해석. "19:30", "1930", "930", "9:30", "19"(→19:00)을 "HH:mm"으로 바꿔요. 잘못되면 null. */
export function parseTime(raw: string, allowHourOnly = false): string | null {
  const t = raw.trim().replace(/[.：]/g, ":");
  let h: string, m: string;
  const c = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (c) { h = c[1]; m = c[2]; }
  else if (/^\d{3,4}$/.test(t)) { h = t.slice(0, -2); m = t.slice(-2); }
  else if (allowHourOnly && /^\d{1,2}$/.test(t)) { h = t; m = "00"; }
  else return null;
  const hh = Number(h), mm = Number(m);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${m}`;
}
export const TIME_HELP = "24시간제로 입력해 주세요. 예: 14:30, 19:00 (오후 7시 → 19:00)";
