"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { actorOf, fmtDate, fromKey, matches, visibleOn, type ShowIndex } from "@/lib/casting";
import { CurtainTag } from "../ui/Tags";
import type { EventItem } from "@/types/event";
import { eventApplies, usableEvent } from "@/lib/eventScope";

interface Props {
  idx: ShowIndex; date: string; sel: Set<string>; only: boolean; events?: EventItem[];
  onOpen: (date: string, sid?: string) => void; onOpenEvent?: (e: EventItem) => void;
}

/**
 * 달력에서 고른 날짜의 회차를 달력 밖에 또렷하게 보여줘요(달력 칸 안 글씨는 작아서).
 * 모바일은 달력 아래, PC(lg)는 달력 옆에 놓여요. 회차를 누르면 기존 상세 시트(내 일정 추가·하트)가 열려요.
 */
export default function DayPanel({ idx, date, sel, only, events = [], onOpen, onOpenEvent }: Props) {
  const filtering = sel.size > 0;
  const list = visibleOn(idx, date, sel, only);
  const total = (idx.byDate.get(date) ?? []).length;
  const evs = events.filter((e) => usableEvent(e) && eventApplies(e, date)); // 이날 어느 회차에든 적용되는 이벤트
  const hits = filtering ? list.filter((s) => matches(idx, s, sel)).length : 0;

  return (
    <section aria-label="선택한 날짜의 회차" className="rounded-2xl border border-line bg-card p-3">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-bold">
        <CalendarDays size={16} aria-hidden className="self-center text-mute" />{fmtDate(fromKey(date))}
        <span className="text-sm font-normal text-mute">
          {filtering ? `선택 조건 ${hits}회 · 전체 ${total}회` : `${total}회차`}
        </span>
      </h3>

      {evs.length > 0 && (
        <ul aria-label="이날의 이벤트" className="mt-2 flex flex-wrap gap-1.5">
          {evs.map((e) => (
            <li key={e.id}><button onClick={() => onOpenEvent?.(e)} className="inline-flex min-h-[36px] items-center rounded-full border border-line bg-bg px-3 text-sm font-medium hover:border-brand">{e.title}</button></li>
          ))}
        </ul>
      )}

      {list.length === 0 ? (
        <p className="mt-2 text-sm text-mute">{total === 0 ? "이 날은 공연이 없어요." : "선택한 조건에 맞는 회차가 없어요. 배우 선택을 해제하면 전체 회차가 보여요."}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {list.map((s) => {
            const ok = filtering && matches(idx, s, sel);
            return (
              <li key={s.id}>
                <button onClick={() => onOpen(date, s.id)} aria-label={`${s.time} 회차 자세히 보기`}
                  className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left ${ok ? "border-brand bg-hit" : "border-line hover:border-brand"} ${filtering && !ok ? "opacity-60" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold tabular-nums">{s.time}</span>
                      {s.curtain && <CurtainTag />}
                      {ok && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-onbrand">선택 조건 일치</span>}
                      {/* 이 회차에 실제로 적용되는 이벤트만 배지로(없으면 아무것도 안 나와요). 여러 개면 모두 보여요. */}
                      {events.filter((e) => usableEvent(e) && eventApplies(e, date, s.time)).map((e) => (
                        <span key={e.id} data-event-badge className="max-w-full break-words rounded bg-hit px-2 py-0.5 text-xs font-medium text-brand">{e.title}</span>
                      ))}
                    </span>
                    <span className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm min-[480px]:grid-cols-2 lg:grid-cols-1">
                      {idx.roles.map((r) => {
                        const a = actorOf(idx, s.cast[r.id]);
                        return (
                          <span key={r.id} className={`flex min-w-0 gap-1.5 ${sel.has(a.id) ? "font-bold text-brand" : ""}`}>
                            <span className="w-14 shrink-0 break-keep text-xs leading-5 text-mute">{r.short || r.name}</span>
                            <span className="min-w-0 break-words">{a.n}</span>
                          </span>
                        );
                      })}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="mt-1 shrink-0 text-mute" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
