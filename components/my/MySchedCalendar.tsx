"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Star, Trash2, X } from "lucide-react";
import type { Show } from "@/types/show";
import { DOW, addDays, fmtDate, fromKey, toKey } from "@/lib/casting";
import { showColor } from "@/lib/mySchedule";
import { readableText } from "@/lib/color";
import { castNames } from "@/lib/ics";
import { CurtainTag } from "../ui/Tags";
import { useWatched } from "@/lib/watched";
import { useDialogFocus } from "@/lib/useDialogFocus";

type Item = { show: Show; session: Show["sessions"][number] };
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** 내 일정 월간 달력. 데이터(저장·삭제)는 부모가 들고 있고, 여기서는 보여주기와 선택만 해요. */
export default function MySchedCalendar({ items, now, today, onRemove, onOpenSession }: {
  items: Item[];
  now: string; // 'YYYY-MM-DD HH:mm' (KST)
  today: string; // 'YYYY-MM-DD' (KST)
  onRemove: (sessionId: string) => void;
  onOpenSession: (i: Item) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => firstOfMonth(fromKey(today)));
  const [selDate, setSelDate] = useState<string | null>(today);
  const [detail, setDetail] = useState<string | null>(null); // session id
  const watched = useWatched();
  const refOf = (i: Item) => ({ sessionId: i.session.id, showId: i.show.id, show: i.show.title, date: i.session.date, time: i.session.time });
  const isWatched = (i: Item) => watched.has(refOf(i));

  const byDate = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) m.set(i.session.date, [...(m.get(i.session.date) ?? []), i]);
    for (const l of m.values()) l.sort((a, b) => a.session.time.localeCompare(b.session.time) || a.show.title.localeCompare(b.show.title));
    return m;
  }, [items]);

  const isPast = (i: Item) => `${i.session.date} ${i.session.time}` < now;
  const detailItem = detail ? items.find((i) => i.session.id === detail) ?? null : null; // 삭제되면 자동으로 null이 돼요

  const days: Date[] = [];
  const f = firstOfMonth(cursor), l = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  for (let d = addDays(f, -f.getDay()); d <= l || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const ym = toKey(cursor).slice(0, 7);
  const monthCount = items.filter((i) => i.session.date.slice(0, 7) === ym).length;
  const step = (dir: -1 | 1) => { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)); setSelDate(null); };
  const goToday = () => { setCursor(firstOfMonth(fromKey(today))); setSelDate(today); };

  const closeDetail = () => setDetail(null);
  const selList = selDate ? byDate.get(selDate) ?? [] : [];
  const label = (i: Item) => `${fmtDate(fromKey(i.session.date))} ${i.session.time} ${i.show.title}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} aria-label="이전 달" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-hit"><ChevronLeft size={18} aria-hidden /></button>
          <h2 aria-live="polite" className="min-w-[7.5rem] text-center font-bold">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</h2>
          <button onClick={() => step(1)} aria-label="다음 달" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-hit"><ChevronRight size={18} aria-hidden /></button>
        </div>
        <button onClick={goToday} className="min-h-[44px] rounded-lg border border-line px-3 text-sm font-medium hover:border-brand">오늘</button>
      </div>
      <p aria-live="polite" className="text-sm text-mute">이번 달 관람 <b className="text-brand">{monthCount}</b>회 · 전체 {items.length}회</p>

      <div role="grid" aria-label="내 일정 달력" className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">
          {DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
          {days.map((day) => {
            const k = toKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const list = byDate.get(k) ?? [];
            const isToday = k === today;
            const isSel = k === selDate;
            const rest2 = list.length - 2, rest3 = list.length - 3;
            return (
              <div key={k} role="gridcell" data-date={k} aria-selected={isSel}
                className={`flex min-h-[5.25rem] min-w-0 flex-col gap-0.5 p-0.5 sm:min-h-[7.5rem] sm:gap-1 sm:p-1 ${isSel ? "outline outline-2 -outline-offset-2 outline-brand" : ""} ${isToday ? "bg-hit" : !inMonth ? "bg-bg" : "bg-card"}`}>
                <button onClick={() => setSelDate(k)} aria-label={`${cursor.getFullYear() === day.getFullYear() ? "" : `${day.getFullYear()}년 `}${fmtDate(day)}${isToday ? " 오늘" : ""} ${list.length ? `일정 ${list.length}개` : "일정 없음"}`}
                  className="flex items-center gap-1 self-start rounded px-0.5 py-0.5 text-[11px] tabular-nums sm:text-xs">
                  <span className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full px-0.5 ${isToday ? "bg-brand font-bold text-onbrand" : day.getDay() === 0 ? "text-brand" : ""} ${!inMonth ? "opacity-40" : ""}`}>{day.getDate()}</span>
                  {list.length > 0 && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />}
                </button>
                {list.slice(0, 3).map((i, n) => {
                  const cast = castNames(i.show, i.session);
                  return (
                    <button key={i.session.id} onClick={() => { setSelDate(k); setDetail(i.session.id); }} aria-label={`${label(i)} 상세 보기`}
                      className={`${n === 2 ? "hidden sm:block" : "block"} w-full min-w-0 rounded-md px-1 py-1 text-left leading-tight hover:brightness-110 sm:px-1.5 ${isPast(i) ? "opacity-55" : ""} ${!inMonth ? "opacity-70" : ""}`}
                      style={{ background: showColor(i.show), color: readableText(showColor(i.show)) }}>
                      <span className="flex items-center gap-x-0.5 text-[11px] font-bold tabular-nums sm:text-xs">{i.session.time}{i.session.curtain && <Star size={9} aria-hidden />}</span>
                      <span className="line-clamp-2 break-keep text-[10px] font-bold sm:line-clamp-1 sm:text-[11px]">{i.show.title}</span>
                      {cast.length > 0 && <span className="hidden truncate text-[10px] sm:block">{cast.slice(0, 2).join(" · ")}{cast.length > 2 ? " 외" : ""}</span>}
                    </button>
                  );
                })}
                {rest2 > 0 && <button onClick={() => setSelDate(k)} aria-label={`${fmtDate(day)} 일정 ${list.length}개 모두 보기`} className={`self-start rounded px-1 text-[10px] font-bold text-brand ${rest3 > 0 ? "" : "sm:hidden"}`}><span className="sm:hidden">+{rest2}개</span><span className="hidden sm:inline">+{rest3}개</span></button>}
              </div>
            );
          })}
        </div>
      </div>

      {selDate && (
        <section aria-label={`${fmtDate(fromKey(selDate))} 일정`} className="rounded-2xl border border-line bg-card p-3">
          <h3 className="mb-2 text-sm font-bold">{fromKey(selDate).getFullYear()}년 {fmtDate(fromKey(selDate))}{selDate === today ? " · 오늘" : ""} <span className="font-normal text-mute">{selList.length}개</span></h3>
          {selList.length === 0 ? <p className="text-sm text-mute">이 날은 관람 일정이 없어요.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {selList.map((i) => {
                const cast = castNames(i.show, i.session);
                return (
                  <li key={i.session.id}>
                    <button onClick={() => { setDetail(i.session.id); }} aria-label={`${label(i)} 상세 보기`}
                      className={`block w-full rounded-xl border border-l-4 border-line bg-bg p-3 text-left hover:border-brand ${isPast(i) ? "opacity-70" : ""}`} style={{ background: showColor(i.show), color: readableText(showColor(i.show)) }}>
                      <span className="flex flex-wrap items-center gap-1.5"><span className="font-bold tabular-nums">{i.session.time}</span>{i.session.curtain && <CurtainTag />}{isWatched(i) ? <span className="inline-flex items-center gap-0.5 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-onbrand"><Check size={11} aria-hidden />관극 완료</span> : isPast(i) && <span className="text-xs text-mute">지난 일정</span>}</span>
                      <span className="mt-0.5 block font-medium">{i.show.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-mute">{cast.length ? cast.join(" · ") : "출연진 미정"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {detailItem && <DetailDialog item={detailItem} past={isPast(detailItem)} watched={isWatched(detailItem)} onToggleWatched={() => { const r = refOf(detailItem); if (isWatched(detailItem)) watched.unmark(r); else watched.mark({ ...r, actors: castNames(detailItem.show, detailItem.session) }); }} onClose={closeDetail} onRemove={onRemove} onOpenSession={onOpenSession} />}
    </div>
  );
}

function DetailDialog({ item, past, watched, onToggleWatched, onClose, onRemove, onOpenSession }: {
  item: Item; past: boolean; watched: boolean; onToggleWatched: () => void; onClose: () => void; onRemove: (id: string) => void; onOpenSession: (i: Item) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialogRef, onClose, closeRef); // 포커스 이동·가두기·Esc·배경 스크롤 잠금·닫으면 포커스 복귀
  const { show, session } = item;
  const d = fromKey(session.date);
  const cast = castNames(show, session);
  const lbl = `${fmtDate(d)} ${session.time} ${show.title}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="내 일정 상세" onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-card p-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 border-l-4 pl-2" style={{ borderLeftColor: showColor(show) }}>
            <p className="text-xs text-mute">{past ? "지난 일정" : "다가오는 일정"}</p>
            <h3 className="font-bold">{show.title}</h3>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="닫기" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-mute hover:text-brand"><X size={18} aria-hidden /></button>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2"><dt className="w-12 shrink-0 text-mute">날짜</dt><dd>{d.getFullYear()}년 {fmtDate(d)}</dd></div>
          <div className="flex gap-2"><dt className="w-12 shrink-0 text-mute">시간</dt><dd className="tabular-nums">{session.time}{session.curtain && <span className="ml-1.5 align-middle"><CurtainTag /></span>}</dd></div>
          {show.venue && <div className="flex gap-2"><dt className="w-12 shrink-0 text-mute">장소</dt><dd>{show.venue}</dd></div>}
          <div className="flex gap-2"><dt className="w-12 shrink-0 text-mute">캐스트</dt><dd>{cast.join(" · ") || "출연진 미정"}</dd></div>
        </dl>
        <div className="mt-4 rounded-xl border border-line bg-bg p-3">
          <button onClick={onToggleWatched} disabled={!past && !watched} aria-pressed={watched}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-sm font-bold disabled:opacity-50 ${watched ? "border-brand bg-brand text-onbrand" : "border-brand text-brand"}`}>
            <Check size={15} aria-hidden />{watched ? "관극 완료 (누르면 취소)" : "관극 완료로 표시"}
          </button>
          <p className="mt-1.5 text-xs text-mute">{watched ? "관극 통계에 반영돼요." : past ? "직접 표시한 회차만 관극 통계에 들어가요." : "공연이 시작된 뒤에 표시할 수 있어요."}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => { onClose(); onOpenSession(item); }} className="min-h-[44px] rounded-lg border border-line px-3 text-sm font-medium hover:border-brand">회차 전체 보기</button>
          {!confirm && <button onClick={() => setConfirm(true)} aria-label={`${lbl} 내 일정에서 삭제`} className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 text-sm text-mute hover:text-brand"><Trash2 size={15} aria-hidden />삭제</button>}
        </div>
        {confirm && (
          <div role="alertdialog" aria-label="삭제 확인" className="mt-3 rounded-xl border border-brand bg-hit p-3">
            <p className="text-sm font-medium">이 일정을 내 일정에서 삭제할까요?</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setConfirm(false)} className="min-h-[44px] flex-1 rounded-lg border border-line bg-card px-3 text-sm">취소</button>
              <button onClick={() => { onRemove(session.id); onClose(); }} className="min-h-[44px] flex-1 rounded-lg bg-brand px-3 text-sm font-bold text-onbrand">삭제</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
