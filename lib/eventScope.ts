import type { EventItem, EventScope } from "@/types/event";
import { fmtDate, fromKey } from "./casting";

/** 회차를 가리키는 키. 회차 id는 백업 복원 때 새로 만들어지므로 날짜+시작 시간으로 이어요. */
export const sessionKey = (date: string, time: string) => `${date} ${time.slice(0, 5)}`;
export const KEY_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
export const keyDate = (k: string) => k.slice(0, 10);
export const keyTime = (k: string) => k.slice(11, 16);

export const SCOPE_LABEL: Record<EventScope, string> = { all: "전체 회차", range: "특정 기간", sessions: "특정 회차" };

/** 화면에 쓸 수 있는 이벤트인지: 기간 방식은 시작일이 있어야 하고, 전체·회차 방식은 날짜 없이도 돼요. */
export function usableEvent(e: Pick<EventItem, "scope" | "startsOn" | "showId" | "sessionKeys">): boolean {
  if (!e.showId) return false;
  if (e.scope === "all") return true;
  if (e.scope === "sessions") return e.sessionKeys.length > 0;
  return !!e.startsOn;
}

/** 이 이벤트가 그 날짜·시작 시간의 회차에 적용되는지. time을 안 주면 그 날짜의 어느 회차든 적용되는지(날짜 단위)를 봐요. */
export function eventApplies(e: EventItem, date: string, time?: string): boolean {
  switch (e.scope) {
    case "all": return true;
    case "sessions": return time === undefined ? e.sessionKeys.some((k) => keyDate(k) === date) : e.sessionKeys.includes(sessionKey(date, time));
    default: return !!e.startsOn && e.startsOn <= date && date <= (e.endsOn || e.startsOn);
  }
}

const byOrder = (a: EventItem, b: EventItem) => (a.startsOn || "").localeCompare(b.startsOn || "") || a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title, "ko");

/** 그 공연의 그 회차(날짜+시간)에 적용되는 이벤트들. 여러 개면 모두 돌려줘요. */
export function eventsForSession(events: EventItem[], showId: string, date: string, time: string): EventItem[] {
  return events.filter((e) => e.showId === showId && usableEvent(e) && eventApplies(e, date, time)).sort(byOrder);
}
/** 그 공연의 그 날짜(어느 회차든)에 적용되는 이벤트들. 날짜에 회차가 있는지는 호출한 쪽이 확인해요. */
export function eventsForDate(events: EventItem[], showId: string, date: string): EventItem[] {
  return events.filter((e) => e.showId === showId && usableEvent(e) && eventApplies(e, date)).sort(byOrder);
}

const nextDay = (d: string) => { const x = fromKey(d); x.setDate(x.getDate() + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

/**
 * 달력 막대용으로 펼쳐요. 막대는 '날짜가 이어진 구간' 하나가 막대 하나예요.
 *  · range: 그대로 · all: 공연의 첫 회차 날짜~마지막 회차 날짜 · sessions: 고른 날짜들 중 이어진 날짜끼리 한 막대
 * 같은 이벤트를 쪼갠 막대는 id 뒤에 ~번호를 붙여요(제목·링크 등은 그대로).
 */
export function displayEvents(events: EventItem[], sessionDates: string[]): EventItem[] {
  const dates = [...new Set(sessionDates)].sort();
  const out: EventItem[] = [];
  for (const e of events) {
    if (!usableEvent(e)) continue;
    if (e.scope === "range") { out.push(e); continue; }
    if (e.scope === "all") {
      if (dates.length) out.push({ ...e, startsOn: dates[0], endsOn: dates[dates.length - 1] });
      continue;
    }
    const ds = [...new Set(e.sessionKeys.map(keyDate))].sort();
    let run: string[] = [], n = 0;
    const flush = () => { if (run.length) { out.push({ ...e, id: `${e.id}~${n++}`, startsOn: run[0], endsOn: run[run.length - 1] }); run = []; } };
    for (const d of ds) { if (run.length && nextDay(run[run.length - 1]) !== d) flush(); run.push(d); }
    flush();
  }
  return out;
}

/** 저장할 때 달력·예전 화면과 맞추려고 채우는 시작·끝 날짜. all은 공연의 첫~마지막 회차, sessions는 고른 회차의 첫~마지막 날짜. */
export function derivedPeriod(scope: EventScope, sessionDates: string[], keys: string[]): { startsOn: string; endsOn: string } {
  const src = scope === "sessions" ? keys.map(keyDate) : sessionDates;
  const s = [...src].sort();
  return s.length ? { startsOn: s[0], endsOn: s[s.length - 1] } : { startsOn: "", endsOn: "" };
}

/** 한 줄 설명(관리자 목록·이벤트 시트). */
export function scopeText(e: Pick<EventItem, "scope" | "startsOn" | "endsOn" | "sessionKeys">): string {
  if (e.scope === "all") return "전체 회차";
  if (e.scope === "sessions") {
    const n = e.sessionKeys.length;
    const ds = new Set(e.sessionKeys.map(keyDate)).size;
    return `선택한 회차 ${n}개 (${ds}일)`;
  }
  return e.startsOn ? (e.endsOn && e.endsOn !== e.startsOn ? `${e.startsOn.replace(/-/g, ".")} ~ ${e.endsOn.replace(/-/g, ".")}` : e.startsOn.replace(/-/g, ".")) : "";
}
/** 선택한 회차를 사람이 읽는 목록으로: "11월 14일 (토) 14:00, 18:00 / 11월 15일 (일) 14:00" */
export function sessionKeysText(keys: string[]): string[] {
  const m = new Map<string, string[]>();
  for (const k of [...keys].sort()) m.set(keyDate(k), [...(m.get(keyDate(k)) ?? []), keyTime(k)]);
  return [...m.entries()].map(([d, ts]) => `${fmtDate(fromKey(d))} ${ts.join(", ")}`);
}
