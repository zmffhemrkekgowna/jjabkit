import { DOW, actorOf, addDays, matches, toKey, visibleOn, type ShowIndex } from "./casting";
import type { MyItem } from "./mySchedule";
import { showColor } from "./mySchedule";
import { isHex6, readableText } from "./color";

/**
 * 달력을 PNG 이미지로 만들어요.
 * - 화면 테마(다크/라이트)와 상관없이 항상 밝은 배경으로 그려서, 메신저에 올려도 잘 보여요.
 * - spec(그릴 내용)을 만드는 함수는 순수 함수라서 따로 테스트할 수 있고, 실제로 그리는 건 renderCalendar 하나예요.
 */
export interface ImgEntry { time: string; text: string; sub?: string; color?: string; /** 카드 바탕색(공연별 스케줄 색). 없으면 기본 카드색 */ fill?: string; hit?: boolean; star?: boolean }
export interface ImgCell { day: number; inMonth: boolean; dow: number; entries: ImgEntry[] }
export interface ImgSpec { title: string; subtitle: string; weeks: ImgCell[][]; dimOthers: boolean; footer: string }

/** 달력 칸 날짜들 (일요일 시작, 7의 배수). */
export function monthDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = addDays(first, -first.getDay()); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** 공연 상세의 캐스팅 달력. 현재 배우 필터(sel)와 "선택한 배우만 보기"(only)를 그대로 반영해요. */
export function castingSpec(showTitle: string, idx: ShowIndex, cursor: Date, sel: Set<string>, only: boolean, color?: string): ImgSpec {
  const cells = monthDays(cursor).map((day): ImgCell => {
    const inMonth = day.getMonth() === cursor.getMonth();
    const list = inMonth ? visibleOn(idx, toKey(day), sel, only) : [];
    return {
      day: day.getDate(), inMonth, dow: day.getDay(),
      entries: list.map((s) => ({
        time: s.time,
        text: idx.roles.slice(0, 3).map((r) => actorOf(idx, s.cast[r.id]).n).join(", ") + (idx.roles.length > 3 ? " …" : ""),
        hit: sel.size > 0 && matches(idx, s, sel),
        star: s.curtain,
        fill: color,
      })),
    };
  });
  const names = [...sel].map((id) => idx.actors.get(id)?.n).filter(Boolean);
  return {
    title: showTitle,
    subtitle: `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 캐스팅 · ${names.length ? `선택한 배우: ${names.join(", ")}` : "전체 회차"}`,
    weeks: chunk(cells, 7), dimOthers: sel.size > 0 && !only,
    footer: "★ 커튼콜 데이   ·   jjabkit",
  };
}

/** 마이페이지 '내 일정' 달력. */
export function mySchedSpec(items: MyItem[], cursor: Date, names: string[]): ImgSpec {
  const ym = toKey(cursor).slice(0, 7);
  const by = new Map<string, MyItem[]>();
  items.filter((i) => i.session.date.slice(0, 7) === ym).forEach((i) => by.set(i.session.date, [...(by.get(i.session.date) ?? []), i]));
  const cells = monthDays(cursor).map((day): ImgCell => {
    const inMonth = day.getMonth() === cursor.getMonth();
    const list = inMonth ? by.get(toKey(day)) ?? [] : [];
    return {
      day: day.getDate(), inMonth, dow: day.getDay(),
      entries: list.map((i) => ({
        time: i.session.time, text: i.hit.join(" · "), sub: i.show.title, fill: showColor(i.show),
        star: i.session.curtain,
      })),
    };
  });
  return {
    title: "내 관심 배우 일정",
    subtitle: `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 · ${names.join(", ")}`,
    weeks: chunk(cells, 7), dimOthers: false,
    footer: "★ 커튼콜 데이   ·   jjabkit",
  };
}

/* ───────── 그리기 ───────── */
export const IMG = { cellW: 150, margin: 40, headH: 124, dowH: 40, footH: 56, entryH: 62, entryHSub: 60, gap: 4, maxEntries: 6, minRowH: 96 } as const;
const C = { bg: "#F4F4F9", card: "#FFFFFF", ink: "#1B1A22", mute: "#6A6877", line: "#E3E1EA", brand: "#8B1E3F", onbrand: "#FFFFFF", hit: "#FBE8EE", out: "#FAFAFC", slot: "#3B2A47" };
const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

/** 칸 높이: 일정이 많은 칸에 맞춰 그 주(줄) 전체를 키워요. 일정이 너무 많으면 +N 한 줄로 줄여요. */
export function rowHeights(spec: ImgSpec): number[] {
  return spec.weeks.map((w) => {
    const need = Math.max(...w.map((c) => {
      const shown = Math.min(c.entries.length, IMG.maxEntries);
      const eh = c.entries.some((e) => e.sub) ? IMG.entryHSub : IMG.entryH;
      return 28 + shown * (eh + IMG.gap) + (c.entries.length > IMG.maxEntries ? 20 : 0) + 6;
    }));
    return Math.max(IMG.minRowH, need);
  });
}
export function imageSize(spec: ImgSpec): { w: number; h: number } {
  return { w: IMG.cellW * 7 + IMG.margin * 2, h: IMG.headH + IMG.dowH + rowHeights(spec).reduce((a, b) => a + b, 0) + IMG.footH };
}

/** 쉼표로 이어진 출연진을 칸 너비에 맞춰 최대 maxLines줄로 나눠요(이름 중간에서는 자르지 않아요). 넘치면 마지막 줄 끝을 …로 줄여요. */
function wrapCast(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const parts = text.split(/(?<=,) /);
  const lines: string[] = [];
  let cur = "";
  for (const p of parts) {
    const t = cur ? `${cur} ${p}` : p;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else { lines.push(cur); cur = p; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(" "); lines.length = maxLines - 1; lines.push(rest); }
  return lines.map((l, i) => (i === lines.length - 1 ? fit(ctx, l, maxW) : l));
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function renderCalendar(spec: ImgSpec, scale = 2): Promise<Blob> {
  try { await document.fonts?.load(`700 20px "Noto Sans KR"`); await document.fonts?.load(`400 20px "Noto Sans KR"`); } catch { /* 폰트가 없어도 기본 글꼴로 그려요 */ }
  const { w, h } = imageSize(spec);
  const canvas = document.createElement("canvas");
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저는 이미지 만들기를 지원하지 않아요.");
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  // 제목
  ctx.fillStyle = C.brand; ctx.font = `700 34px ${FONT}`; ctx.fillText(fit(ctx, spec.title, w - IMG.margin * 2), IMG.margin, 62);
  ctx.fillStyle = C.mute; ctx.font = `400 20px ${FONT}`; ctx.fillText(fit(ctx, spec.subtitle, w - IMG.margin * 2), IMG.margin, 100);

  // 요일
  const top = IMG.headH;
  ctx.font = `500 18px ${FONT}`; ctx.textAlign = "center";
  DOW.forEach((d, i) => { ctx.fillStyle = i === 0 ? C.brand : C.mute; ctx.fillText(d, IMG.margin + i * IMG.cellW + IMG.cellW / 2, top + 27); });
  ctx.textAlign = "left";

  const heights = rowHeights(spec);
  let y = top + IMG.dowH;
  const gridTop = y;
  spec.weeks.forEach((week, wi) => {
    const rh = heights[wi];
    week.forEach((cell, ci) => {
      const x = IMG.margin + ci * IMG.cellW;
      ctx.fillStyle = !cell.inMonth ? C.out : cell.entries.some((e) => e.hit) ? C.hit : C.card;
      ctx.fillRect(x, y, IMG.cellW, rh);
      if (!cell.inMonth) return;
      ctx.fillStyle = cell.dow === 0 ? C.brand : C.ink; ctx.font = `500 16px ${FONT}`; ctx.fillText(String(cell.day), x + 8, y + 22);
      const sub = cell.entries.some((e) => e.sub);
      const eh = sub ? IMG.entryHSub : IMG.entryH;
      cell.entries.slice(0, IMG.maxEntries).forEach((e, k) => {
        const ex = x + 5, ey = y + 30 + k * (eh + IMG.gap), ew = IMG.cellW - 10;
        const dim = spec.dimOthers && !e.hit;
        ctx.globalAlpha = dim ? 0.4 : 1;
        const fillOk = !e.hit && !!e.fill && isHex6(e.fill);
        ctx.fillStyle = e.hit ? C.brand : fillOk ? e.fill! : C.slot; ctx.fillRect(ex, ey, ew, eh);
        const fg = e.hit ? C.onbrand : fillOk ? readableText(e.fill!) : C.onbrand;
        if (e.color) { ctx.fillStyle = e.color; ctx.fillRect(ex, ey, 5, eh); }
        const tx = ex + (e.color ? 11 : 7), tw = ew - (e.color ? 16 : 12);
        ctx.fillStyle = fg; ctx.font = `700 14px ${FONT}`;
        ctx.fillText(`${e.time}${e.star ? " ★" : ""}`, tx, ey + 18);
        if (e.sub) {
          ctx.font = `700 14px ${FONT}`; ctx.fillText(fit(ctx, e.text, tw), tx, ey + 36);
          ctx.font = `400 12px ${FONT}`; ctx.globalAlpha *= 0.85; ctx.fillText(fit(ctx, e.sub, tw), tx, ey + 52);
        } else {
          ctx.font = `500 13px ${FONT}`;
          wrapCast(ctx, e.text, tw, 2).forEach((ln, li) => ctx.fillText(ln, tx, ey + 36 + li * 16));
        }
        ctx.globalAlpha = 1;
      });
      if (cell.entries.length > IMG.maxEntries) {
        ctx.fillStyle = C.mute; ctx.font = `500 13px ${FONT}`;
        ctx.fillText(`+${cell.entries.length - IMG.maxEntries}개 더`, x + 8, y + 30 + IMG.maxEntries * (eh + IMG.gap) + 12);
      }
    });
    y += rh;
  });
  // 격자선
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  for (let i = 0; i <= 7; i++) { const lx = IMG.margin + i * IMG.cellW + 0.5; ctx.beginPath(); ctx.moveTo(lx, gridTop); ctx.lineTo(lx, y); ctx.stroke(); }
  let ly = gridTop;
  for (let r = 0; r <= heights.length; r++) { ctx.beginPath(); ctx.moveTo(IMG.margin, ly + 0.5); ctx.lineTo(IMG.margin + IMG.cellW * 7, ly + 0.5); ctx.stroke(); ly += heights[r] ?? 0; }

  ctx.fillStyle = C.mute; ctx.font = `400 15px ${FONT}`; ctx.fillText(spec.footer, IMG.margin, h - 22);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))), "image/png"));
}
