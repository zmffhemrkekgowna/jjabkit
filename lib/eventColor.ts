import type { EventItem } from "@/types/event";
import { isHex6 } from "./color";

/**
 * 색을 따로 고르지 않은 이벤트(엑셀로 등록한 이벤트, 관리자 화면에서 '자동'으로 둔 이벤트)에 쓰는 자동 색 7가지.
 * 순서·값을 바꾸면 이미 보이던 자동 색이 바뀌니 바꾸지 마세요(새 색은 맨 뒤에만 붙이기).
 */
export const AUTO_EVENT_COLORS: string[] = ["#dc2626", "#ea580c", "#facc15", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];

const normTitle = (t: string) => (t ?? "").replace(/\s+/g, "").toLowerCase();

/** 이벤트 이름으로 정하는 기본 자리(FNV-1a). 같은 이름이면 언제나 같은 색이에요. */
function titleIndex(title: string): number {
  let h = 0x811c9dc5;
  for (const ch of normTitle(title)) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h % AUTO_EVENT_COLORS.length;
}

/** 이벤트 이름만으로 정하는 자동 색(목록 없이 한 개만 있을 때 쓰는 대체값). */
export const titleColor = (title: string) => AUTO_EVENT_COLORS[titleIndex(title)];

const DAY = 86400000;
const toDay = (d: string) => { const t = Date.parse(`${d}T00:00:00Z`); return Number.isNaN(t) ? null : t / DAY; };
/** 달력에서 같은 주·이웃한 주에 함께 보일 수 있으면 '가깝다'고 봐요(기간이 겹치거나 7일 이내). 날짜가 없으면 늘 가깝다고 봐요. */
function near(a: EventItem, b: EventItem): boolean {
  const as = toDay(a.startsOn), bs = toDay(b.startsOn);
  if (as === null || bs === null) return true;
  const ae = toDay(a.endsOn) ?? as, be = toDay(b.endsOn) ?? bs;
  return as <= be + 7 && bs <= ae + 7;
}

/**
 * 색을 고르지 않은 이벤트마다 autoColor(화면 표시용, DB에는 저장하지 않음)를 붙여요.
 * - 공연별로, 먼저 만든 이벤트부터 차례로 정해요. 그래서 새 이벤트를 등록해도 앞서 있던 이벤트의 색은 바뀌지 않아요.
 * - 기본은 이벤트 이름으로 정한 색이고, 같은 공연에서 가까운 날짜의 다른 이벤트(직접 고른 색 포함)가 이미 그 색이면 팔레트의 다음 색으로 넘겨요.
 * - 같은 공연의 같은 이름 이벤트는 같은 색을 써요.
 * 입력 배열의 순서는 그대로 두고 새 배열을 돌려줘요.
 */
export function assignEventColors(events: EventItem[]): EventItem[] {
  const auto = new Map<string, string>();
  const byShow = new Map<string, EventItem[]>();
  for (const e of events) { const k = e.showId || ""; if (!byShow.has(k)) byShow.set(k, []); byShow.get(k)!.push(e); }
  for (const list of byShow.values()) {
    const ordered = [...list].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") || a.id.localeCompare(b.id));
    const done: { ev: EventItem; color: string }[] = [];
    const byTitle = new Map<string, string>();
    for (const e of ordered) {
      if (isHex6(e.color)) { done.push({ ev: e, color: e.color.toLowerCase() }); continue; }
      const key = normTitle(e.title);
      let color = byTitle.get(key);
      if (!color) {
        const base = titleIndex(e.title);
        const taken = new Set(done.filter((d) => normTitle(d.ev.title) !== key && near(d.ev, e)).map((d) => d.color));
        color = AUTO_EVENT_COLORS[base];
        for (let i = 0; i < AUTO_EVENT_COLORS.length; i++) {
          const c = AUTO_EVENT_COLORS[(base + i) % AUTO_EVENT_COLORS.length];
          if (!taken.has(c)) { color = c; break; }
        }
        byTitle.set(key, color);
      }
      auto.set(e.id, color);
      done.push({ ev: e, color });
    }
  }
  return events.map((e) => (auto.has(e.id) ? { ...e, autoColor: auto.get(e.id) } : e));
}

/** 화면에 그릴 이벤트 색: 직접 고른 색 → 자동 색 → (목록 없이 받은 경우) 이름으로 정한 색. 검정으로 떨어지는 일은 없어요. */
export function eventColor(e: Pick<EventItem, "color" | "title"> & { autoColor?: string }): string {
  if (isHex6(e.color)) return e.color;
  if (e.autoColor && isHex6(e.autoColor)) return e.autoColor;
  return titleColor(e.title);
}
