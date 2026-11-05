"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Trash2 } from "lucide-react";
import type { Role, Session, SessionInput, Show } from "@/types/show";
import { bulkUpdateSessions, deleteSessions, restoreNote, restoreSessions, saveSession } from "@/lib/db/shows";
import { bySlot, planTimeChange } from "@/lib/bulkSessions";
import { useDirty } from "./dirty";
import TimeInput from "./TimeInput";
import CastField from "./CastField";
import { DOW, addDays, fmtDate, fromKey, toKey } from "@/lib/casting";
import type { EventItem } from "@/types/event";
import { weekBars } from "@/components/casting/MonthView";
import SlotCard from "@/components/casting/SlotCard";
import { showColor } from "@/lib/mySchedule";
import { isHex6, readableOn } from "@/lib/color";
import { planRepeat } from "@/lib/repeatSessions";
import { Fld, Sec, btn, friendly, ghost, iconBtn, inp, showToast, undoAction, type Notify, type Run } from "./shared";

/** 배역 하나의 배우 고르기. PC는 드롭다운, 모바일은 카드 + 아래에서 올라오는 선택 패널이에요(CastField). */
const castSelect = (r: Role, value: string, onChange: (v: string) => void, compact = false) => (
  <CastField key={r.id} role={r} value={value} onChange={onChange} compact={compact} />
);

const caption = (show: Show, s: Session) => {
  const nm = show.roles.map((r) => r.actors.find((a) => a.id === s.cast[r.id])?.n ?? "미정");
  return `${s.date.slice(5).replace("-", "/")}(${DOW[fromKey(s.date).getDay()]}) ${s.time} · ${nm.join("/")}`;
};

/** 등록된 회차 한 줄(표의 한 행): 선택 체크, 날짜, 시간, 배역별 배우, 삭제. 배우 선택은 바로 저장하고, 날짜·시간은 입력을 마치면(포커스 이동) 저장해요. */
function SessionRow({ show, s, run, picked, onPick }: { show: Show; s: Session; run: Run; picked: boolean; onPick: (v: boolean) => void }) {
  const [dt, setDt] = useState({ date: s.date, time: s.time });
  useEffect(() => { setDt({ date: s.date, time: s.time }); }, [s.date, s.time]);

  // 커튼콜·타임세일 값은 이 화면에서 바꾸지 않아요. 저장할 때 기존 값을 그대로 보내 지워지지 않게 해요.
  const save = (patch: Partial<SessionInput>) =>
    run((db) => saveSession(db, show.id, { date: s.date, time: s.time, cast: s.cast, curtain: s.curtain, timesale: s.timesale, ...patch }, s.id));
  const commitDateTime = () => { if (dt.date && dt.time && (dt.date !== s.date || dt.time !== s.time)) save(dt); };
  const commitRef = useRef(commitDateTime); commitRef.current = commitDateTime; // 입력칸이 방금 정리한 값으로 저장하도록 렌더 뒤에 호출해요
  const del = () => run((db) => deleteSessions(db, show.id, [s.id]), "회차가 삭제되었습니다.", () => run((db) => restoreSessions(db, show.id, [s]), (r) => `삭제한 회차를 되살렸어요. ${restoreNote(r)}`.trim()));

  return (
    <li className={`rounded-xl border border-l-4 p-2.5 ${picked ? "border-brand bg-hit" : "border-line"}`} style={{ borderLeftColor: showColor(show) }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {/* 1) 회차 날짜·시간 (PC에서는 예전처럼 한 줄로 이어져요) */}
        <div className="flex flex-wrap items-center gap-2 sm:contents">
          <label className="-m-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} aria-label={`${s.date} ${s.time} 회차 선택`} className="h-5 w-5 accent-[var(--brand)]" /></label>
          <input type="date" value={dt.date} onChange={(e) => setDt({ ...dt, date: e.target.value })} onBlur={commitDateTime} aria-label="날짜" className={`${inp} min-w-0 flex-1 sm:!w-auto sm:flex-none`} />
          <span aria-hidden className="w-4 text-xs text-mute">{dt.date ? DOW[fromKey(dt.date).getDay()] : ""}</span>
          <div className="w-24"><TimeInput value={dt.time} onChange={(v) => setDt((d) => ({ ...d, time: v }))} onBlur={() => setTimeout(() => commitRef.current(), 0)} label="시간" /></div>
        </div>
        {/* 2) 캐스팅: 모바일은 배역마다 카드 하나(배역명 + 배우), 배우를 고르면 바로 저장돼요 */}
        <div className="min-w-0 border-t border-line pt-3 sm:flex-1 sm:border-0 sm:p-0">
          <p className="mb-2 text-xs font-bold text-mute sm:hidden">캐스팅 <span className="font-normal">· 배우를 고르면 바로 저장돼요</span></p>
          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
            {show.roles.map((r) => castSelect(r, s.cast[r.id] ?? "", (v) => save({ cast: { ...s.cast, [r.id]: v } }), true))}
          </div>
        </div>
        {/* 3) 삭제: 모바일에서는 글자가 있는 붉은 버튼으로, 배우 선택과 구분해요 */}
        <button onClick={del} aria-label="회차 삭제" className={`${iconBtn} gap-1.5 self-end border-red-300 px-3 text-red-600 sm:ml-auto sm:self-auto sm:border-line sm:px-2 sm:text-mute`}><Trash2 size={16} aria-hidden /><span className="text-sm sm:hidden">회차 삭제</span></button>
      </div>
    </li>
  );
}

/** 체크한 회차를 한꺼번에 고치는 줄: 배역 배정 · 다른 회차 캐스팅 복사 · 시간 변경 · 삭제. (커튼콜·타임세일은 일괄 대상이 아니에요) */
function BulkBar({ show, chosen, run, clear }: { show: Show; chosen: Session[]; run: Run; clear: () => void }) {
  const [roleId, setRoleId] = useState(show.roles[0]?.id ?? "");
  const [actorId, setActorId] = useState("");
  const [srcId, setSrcId] = useState("");
  const [time, setTime] = useState("19:30");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = show.roles.find((r) => r.id === roleId) ?? show.roles[0];
  const sources = [...show.sessions].sort(bySlot);
  const chosenKey = chosen.map((c) => c.id).join();
  useEffect(() => { setAsk(false); }, [chosenKey]);

  /** 회차들을 DB에서 한 번에 저장해요(하나라도 실패하면 전부 취소). 되돌릴 수 있게 바꾸기 전 값을 기억해 둬요. */
  const edit = async (items: Session[], next: (s: Session) => SessionInput, what: string, extra = "") => {
    if (items.length === 0) { showToast(extra || "바꿀 회차가 없어요.", "error"); return; }
    setBusy(true);
    const prev = items.map((s) => ({ ...s, cast: { ...s.cast } }));
    const ok = await run((db) => bulkUpdateSessions(db, show.id, items.map((s) => { const n = next(s); return { id: s.id, date: n.date, time: n.time, curtain: n.curtain, timesale: n.timesale, cast: n.cast }; })));
    setBusy(false);
    if (!ok) return; // 실패하면 run이 이유를 알려 주고, DB에는 아무것도 바뀌지 않았어요
    const undo = () => run((db) => bulkUpdateSessions(db, show.id, prev.map((p) => ({ id: p.id, date: p.date, time: p.time, curtain: p.curtain, timesale: p.timesale, cast: p.cast }))), "바꾸기 전으로 되돌렸어요.");
    showToast(`${what} ${items.length}개를 바꿨어요.${extra ? ` ${extra}` : ""}`, "ok", undoAction(undo));
  };
  const base = (s: Session) => ({ date: s.date, time: s.time, cast: s.cast, curtain: s.curtain, timesale: s.timesale });

  const applyActor = () => role && edit(chosen, (s) => ({ ...base(s), cast: { ...s.cast, [role.id]: actorId } }), `'${role.name}' 배우 ${actorId ? role.actors.find((a) => a.id === actorId)?.n ?? "" : "미정"} 배정`);
  const copyCast = () => {
    const src = show.sessions.find((x) => x.id === srcId); if (!src) return;
    edit(chosen.filter((s) => s.id !== src.id), (s) => ({ ...base(s), cast: { ...Object.fromEntries(show.roles.map((r) => [r.id, src.cast[r.id] ?? ""])) } }), "캐스팅 복사");
  };
  const changeTime = () => {
    const p = planTimeChange(chosen, show.sessions, time);
    const extra = [p.same.length ? `이미 ${time}인 ${p.same.length}개는 그대로` : "", p.skipped.length ? `같은 날 ${time}에 이미 회차가 있어 ${p.skipped.length}개는 건너뜀` : ""].filter(Boolean).join(", ");
    edit(p.ok, (s) => ({ ...base(s), time }), `시간 ${time}으로`, extra ? `(${extra})` : "");
  };
  const del = async () => {
    setBusy(true);
    const items = chosen.map((s) => ({ ...s, cast: { ...s.cast } }));
    const ok = await run((db) => deleteSessions(db, show.id, items.map((s) => s.id)),
      `회차 ${items.length}개를 삭제했어요.`, () => run((db) => restoreSessions(db, show.id, items), (r) => `삭제한 회차 ${items.length}개를 되살렸어요. ${restoreNote(r)}`.trim()));
    setBusy(false); setAsk(false); if (ok) clear();
  };

  return (
    <div role="region" aria-label="선택한 회차 일괄 작업" className="sticky top-14 z-20 mb-2 space-y-2 rounded-xl border border-brand bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">선택한 회차 <span className="text-brand">{chosen.length}개</span></p>
        <button onClick={clear} className="min-h-[44px] px-2 text-xs text-mute underline sm:min-h-0">선택 해제</button>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {show.roles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-bg p-2">
            <span className="w-full text-xs font-medium text-mute">배우 한꺼번에 배정</span>
            <select value={role?.id ?? ""} onChange={(e) => { setRoleId(e.target.value); setActorId(""); }} aria-label="일괄 배정할 배역" className={`${inp} !w-auto`}>
              {show.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={actorId} onChange={(e) => setActorId(e.target.value)} aria-label="일괄 배정할 배우" className={`${inp} !w-auto`}>
              <option value="">미정</option>
              {role?.actors.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}
            </select>
            <button onClick={applyActor} disabled={busy} className={ghost}>적용</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-bg p-2">
          <span className="w-full text-xs font-medium text-mute">다른 회차의 캐스팅 복사 (모든 배역)</span>
          <select value={srcId} onChange={(e) => setSrcId(e.target.value)} aria-label="캐스팅을 복사해 올 회차" className={`${inp} min-w-0 flex-1`}>
            <option value="">복사해 올 회차 선택</option>
            {sources.map((x) => <option key={x.id} value={x.id}>{caption(show, x)}</option>)}
          </select>
          <button onClick={copyCast} disabled={busy || !srcId} className={ghost}>복사해서 적용</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-bg p-2">
          <span className="w-full text-xs font-medium text-mute">시간 한꺼번에 변경</span>
          <div className="w-24"><TimeInput value={time} onChange={setTime} label="바꿀 시간" /></div>
          <button onClick={changeTime} disabled={busy || !time} className={ghost}>시간 바꾸기</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-bg p-2">
          <span className="w-full text-xs font-medium text-mute">삭제</span>
          {ask ? (
            <>
              <span className="text-sm">{chosen.length}개를 삭제할까요?</span>
              <button onClick={del} disabled={busy} className={btn}>삭제 확인</button>
              <button onClick={() => setAsk(false)} className={ghost}>취소</button>
            </>
          ) : <button onClick={() => setAsk(true)} disabled={busy} className={ghost}><Trash2 size={14} aria-hidden />선택 삭제</button>}
          <span className="text-xs text-mute">삭제 직후 &lsquo;실행 취소&rsquo;로 되살릴 수 있어요.</span>
        </div>
      </div>
    </div>
  );
}

const BLANK = { date: "", time: "19:30", curtain: false, timesale: false, cast: {} as Record<string, string> };
const monthOf = (k: string) => { const d = fromKey(k); return new Date(d.getFullYear(), d.getMonth(), 1); };

/** 등록된 회차를 달력으로 보여줘요. 날짜를 누르면 그 날의 회차를 아래에서 고칠 수 있어요. */
function SessionsCalendar({ show, events, cursor, sel, onSel, onMonth }: { show: Show; events: EventItem[]; cursor: Date; sel: string; onSel: (k: string) => void; onMonth: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = addDays(first, -first.getDay()); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const by = new Map<string, Session[]>();
  for (const x of [...show.sessions].sort((a, b) => a.time.localeCompare(b.time))) by.set(x.date, [...(by.get(x.date) ?? []), x]);
  const nameOf = (r: Role, id: string | undefined) => r.actors.find((a) => a.id === id)?.n ?? "미정";
  const inMonthCount = show.sessions.filter((x) => x.date.slice(0, 7) === toKey(first).slice(0, 7)).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-1">
        <button onClick={() => onMonth(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="이전 달" className="rounded-lg p-2"><ChevronLeft size={18} aria-hidden /></button>
        <h3 className="min-w-[9rem] text-center font-bold">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월 <span className="text-xs font-normal text-mute">{inMonthCount}회차</span></h3>
        <button onClick={() => onMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="다음 달" className="rounded-lg p-2"><ChevronRight size={18} aria-hidden /></button>
      </div>
      <div role="grid" aria-label={`${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 등록된 회차`} className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">{DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}</div>
        <div className="space-y-px border-t border-line bg-line [--lane:1.25rem] sm:[--lane:1.5rem]">
          {Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7)).map((week) => {
            const keys = week.map(toKey);
            const inMonth = week.map((d) => d.getMonth() === cursor.getMonth());
            const { bars, lanes } = weekBars(events, keys, inMonth);
            return (
              <div key={keys[0]} role="row" className="relative">
                <div className="grid grid-cols-7 gap-px bg-line">
                  {week.map((day, i) => {
                    const k = keys[i];
                    const inM = inMonth[i];
                    const list = by.get(k) ?? [];
                    const on = k === sel;
                    return (
                      <button key={k} role="gridcell" onClick={() => onSel(k)} aria-pressed={on}
                        aria-label={`${fmtDate(day)} ${list.length ? `회차 ${list.length}개` : "회차 없음"}`}
                        className={`flex min-h-[3.75rem] min-w-0 flex-col gap-0.5 p-0.5 text-left sm:min-h-[5rem] sm:gap-1 sm:p-1 ${on ? "relative z-10 bg-hit ring-2 ring-inset ring-[var(--brand)]" : inM ? "bg-card hover:bg-hit" : "bg-bg"}`}>
                        <span className={`flex h-5 shrink-0 items-center px-0.5 text-[11px] tabular-nums sm:text-xs ${!inM ? "opacity-30" : day.getDay() === 0 ? "text-brand" : ""}`}>{day.getDate()}</span>
                        {lanes > 0 && <span aria-hidden style={{ height: `calc(${lanes} * var(--lane))` }} className="block shrink-0" />}
                        {inM && list.map((x) => <SlotCard key={x.id} as="span" color={showColor(show)} time={x.time} all={show.roles.map((r) => nameOf(r, x.cast[r.id]))} />)}
                      </button>
                    );
                  })}
                </div>
                {bars.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-5 z-20">
                    {bars.map((b) => (
                      <span key={b.ev.id} role="note" title={`${b.ev.title} (${b.ev.startsOn}${b.ev.endsOn ? ` ~ ${b.ev.endsOn}` : ""})`} aria-label={`이벤트 ${b.ev.title}`}
                        style={{ top: `calc(${b.lane} * var(--lane))`, height: "calc(var(--lane) - 2px)", left: `calc(${b.col} / 7 * 100% + 1px)`, width: `calc(${b.span} / 7 * 100% - 2px)`, ...(isHex6(b.ev.color) ? { background: b.ev.color, color: readableOn(b.ev.color) } : {}) }}
                        className={`absolute truncate ${isHex6(b.ev.color) ? "" : "bg-ink text-bg"} px-1 text-left text-[10px] font-bold leading-[calc(1.25rem-2px)] sm:px-1.5 sm:text-xs sm:leading-[calc(1.5rem-2px)] ${b.contLeft ? "rounded-l-none" : "rounded-l-md"} ${b.contRight ? "rounded-r-none" : "rounded-r-md"}`}>
                        {b.ev.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SessionsEditor({ show, events = [], run, notify }: { show: Show; events?: EventItem[]; run: Run; notify: Notify }) {
  const sorted = [...show.sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const [dd, setDd] = useState(BLANK);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState<Date>(() => monthOf(sorted[0]?.date ?? show.start ?? "2026-01-01"));
  const [sel, setSel] = useState("");
  const date = dd.date || sel || show.start;
  const [mode, setMode] = useState<"one" | "repeat">("one");
  const [rp, setRp] = useState({ start: show.start ?? "", end: show.end ?? "", days: [] as number[], time: "19:30" });
  const [rpAsk, setRpAsk] = useState(false);
  const [rpBusy, setRpBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 삭제·변경으로 사라진 회차는 선택에서 빠져요
  const chosen = useMemo(() => show.sessions.filter((x) => picked.has(x.id)).sort(bySlot), [show.sessions, picked]);
  const togglePick = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  useDirty(`session-add-${show.id}`, "회차 추가 입력", (mode === "one" && (dd.time !== BLANK.time || Object.keys(dd.cast).length > 0)) || (mode === "repeat" && rp.days.length > 0));
  const plan = planRepeat(rp.start, rp.end, rp.days, rp.time, show.sessions.map((x) => `${x.date} ${x.time.slice(0, 5)}`));
  const setRpf = (patch: Partial<typeof rp>) => { setRpAsk(false); setRp((r) => ({ ...r, ...patch })); };

  const pickDay = (k: string) => { setSel(k); setDd((d) => ({ ...d, date: k })); };

  const add = async () => {
    if (!date || !dd.time) { notify("날짜와 시간을 입력해 주세요."); showToast("날짜와 시간을 입력해 주세요.", "error"); return; }
    const cast = Object.fromEntries(show.roles.map((r) => [r.id, dd.cast[r.id] ?? r.actors[0]?.id ?? ""]));
    const ok = await run((db) => saveSession(db, show.id, { date, time: dd.time, cast, curtain: dd.curtain, timesale: dd.timesale }), `회차가 추가되었습니다. (${date} ${dd.time})`);
    if (ok) { setCursor(monthOf(date)); setSel(date); }
  };

  const addRepeat = async () => {
    if (plan.problem || plan.dates.length === 0) return;
    setRpBusy(true);
    const cast = Object.fromEntries(show.roles.map((r) => [r.id, ""])); // 캐스팅은 미정으로 만들어요
    let made = 0, failed = 0, firstErr = "";
    const ok = await run(async (db) => {
      for (const d of plan.dates) {
        try { await saveSession(db, show.id, { date: d, time: rp.time, cast, curtain: false, timesale: false }); made++; }
        catch (e) { failed++; if (!firstErr) firstErr = e instanceof Error ? e.message : String(e); }
      }
    });
    setRpBusy(false); setRpAsk(false);
    if (!ok) return;
    const why = firstErr ? ` (${friendly(new Error(firstErr))})` : "";
    const msg = made === 0 ? `회차를 추가하지 못했어요.${why}`
      : `회차 ${made}개를 추가했어요.${plan.skipped.length ? ` (이미 있는 ${plan.skipped.length}개는 건너뜀)` : ""}${failed ? ` 저장하지 못한 ${failed}개가 있어요${why}. 다시 시도하면 남은 날짜만 만들어져요.` : ""}`;
    notify(msg); showToast(msg, failed ? "error" : "ok");
    if (made > 0) { setCursor(monthOf(plan.dates[0])); setSel(plan.dates[0]); setView("calendar"); }
  };

  const list = view === "list"
    ? sorted.filter((x) => !filter || x.date === filter)
    : sorted.filter((x) => x.date === sel);

  const allOn = list.length > 0 && list.every((x) => picked.has(x.id));
  const selAll = list.length > 1 && (
    <label className="mb-2 inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={allOn} onChange={(e) => setPicked((p) => { const n = new Set(p); list.forEach((x) => (e.target.checked ? n.add(x.id) : n.delete(x.id))); return n; })} className="h-5 w-5 accent-[var(--brand)]" />
      보이는 회차 {list.length}개 모두 선택
    </label>
  );
  const bulk = chosen.length > 0 && <BulkBar show={show} chosen={chosen} run={run} clear={() => setPicked(new Set())} />;

  return (
    <Sec title="캐스팅 스케줄">
      <div className="rounded-xl border border-line p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">회차 추가</p>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="추가 방식">
            <button aria-pressed={mode === "one"} onClick={() => setMode("one")} className={`rounded-md px-3 py-1 text-sm ${mode === "one" ? "bg-ink text-bg" : "text-mute"}`}>하나씩</button>
            <button aria-pressed={mode === "repeat"} onClick={() => setMode("repeat")} className={`rounded-md px-3 py-1 text-sm ${mode === "repeat" ? "bg-ink text-bg" : "text-mute"}`}>반복 등록</button>
          </div>
        </div>
        {mode === "repeat" ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Fld label="시작일"><input type="date" value={rp.start} onChange={(e) => setRpf({ start: e.target.value })} className={inp} /></Fld>
              <Fld label="종료일"><input type="date" value={rp.end} onChange={(e) => setRpf({ end: e.target.value })} className={inp} /></Fld>
              <Fld label="회차 시간"><TimeInput value={rp.time} onChange={(v) => setRpf({ time: v })} label="회차 시간" /></Fld>
            </div>
            <div>
              <p className="text-xs font-medium text-mute">요일</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="반복할 요일">
                {DOW.map((w, i) => {
                  const on = rp.days.includes(i);
                  return <button key={w} type="button" aria-pressed={on} onClick={() => setRpf({ days: on ? rp.days.filter((x) => x !== i) : [...rp.days, i].sort() })}
                    className={`h-9 w-9 rounded-full border text-sm ${on ? "border-brand bg-brand font-bold text-onbrand" : "border-line text-mute"}`}>{w}</button>;
                })}
                <button type="button" onClick={() => setRpf({ days: [1, 2, 3, 4, 5] })} className="ml-1 text-xs text-mute underline">평일</button>
                <button type="button" onClick={() => setRpf({ days: [0, 6] })} className="text-xs text-mute underline">주말</button>
                <button type="button" onClick={() => setRpf({ days: [0, 1, 2, 3, 4, 5, 6] })} className="text-xs text-mute underline">매일</button>
              </div>
            </div>
            <p aria-live="polite" data-testid="repeat-preview" className="rounded-lg bg-bg px-3 py-2 text-sm">
              {plan.problem ? <span className="text-mute">{plan.problem}</span>
                : plan.dates.length === 0 ? <span className="text-mute">새로 만들 회차가 없어요. 선택한 날짜·시간에 이미 회차가 있어요.</span>
                : <>회차 <b>{plan.dates.length}개</b>가 만들어져요 <span className="text-mute">({plan.dates[0]} ~ {plan.dates[plan.dates.length - 1]}){plan.skipped.length > 0 && ` · 이미 있는 ${plan.skipped.length}개는 건너뜀`}</span></>}
            </p>
            <p className="text-xs text-mute">캐스팅은 모두 &lsquo;미정&rsquo;으로 만들어져요. 만든 뒤 달력에서 날짜를 눌러 배우를 채워 주세요.</p>
            {rpAsk ? (
              <div role="alertdialog" aria-label="반복 등록 확인" className="flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-hit p-3 text-sm">
                <span className="min-w-0 flex-1">회차 {plan.dates.length}개를 한 번에 추가할까요?</span>
                <button onClick={addRepeat} disabled={rpBusy} className={btn}>{rpBusy ? "추가하는 중…" : "추가하기"}</button>
                <button onClick={() => setRpAsk(false)} disabled={rpBusy} className={ghost}>취소</button>
              </div>
            ) : (
              <button onClick={() => setRpAsk(true)} disabled={!!plan.problem || plan.dates.length === 0} className={btn}><Plus size={14} aria-hidden />{plan.dates.length > 0 ? `${plan.dates.length}개 회차 만들기` : "회차 만들기"}</button>
            )}
          </div>
        ) : (<>
        <div className="grid gap-2 sm:grid-cols-2">
          <Fld label="날짜"><input type="date" value={date} onChange={(e) => setDd({ ...dd, date: e.target.value })} className={inp} /></Fld>
          <Fld label="회차 시간"><TimeInput value={dd.time} onChange={(v) => setDd((d) => ({ ...d, time: v }))} label="회차 시간" /></Fld>
          {show.roles.map((r) => castSelect(r, dd.cast[r.id] ?? r.actors[0]?.id ?? "", (v) => setDd({ ...dd, cast: { ...dd.cast, [r.id]: v } })))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button onClick={add} className={`${btn} ml-auto`}><Plus size={14} aria-hidden />회차 추가</button>
        </div>
        </>)}
      </div>

      <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">등록된 회차 <span className="font-normal text-mute">{show.sessions.length}개</span></p>
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="보기 방식">
          <button aria-pressed={view === "calendar"} onClick={() => setView("calendar")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm ${view === "calendar" ? "bg-ink text-bg" : "text-mute"}`}><CalendarDays size={14} aria-hidden />달력</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm ${view === "list" ? "bg-ink text-bg" : "text-mute"}`}><List size={14} aria-hidden />목록</button>
        </div>
      </div>

      {view === "calendar" ? (
        <>
          <SessionsCalendar show={show} events={events} cursor={cursor} sel={sel} onSel={pickDay} onMonth={setCursor} />
          <p className="mb-2 mt-4 text-sm font-bold">
            {sel ? `${fmtDate(fromKey(sel))} 회차` : "날짜를 눌러 회차를 고쳐 보세요"} {sel && <span className="font-normal text-mute">{list.length}개</span>}
          </p>
          {sel && list.length === 0 && <p className="rounded-xl border border-dashed border-line py-5 text-center text-sm text-mute">이 날은 회차가 없어요. 위 &lsquo;회차 추가&rsquo;의 날짜가 {sel}로 채워져 있어요.</p>}
          {bulk}
          {selAll}
          <ul className="space-y-2">{list.map((x) => <SessionRow key={x.id} show={show} s={x} run={run} picked={picked.has(x.id)} onPick={(v) => togglePick(x.id, v)} />)}</ul>
        </>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-end gap-2">
            <input type="date" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="날짜로 찾기" className={`${inp} !w-auto`} />
            {filter && <button onClick={() => setFilter("")} className="text-xs text-mute underline">전체 보기</button>}
          </div>
          {list.length === 0 && <p className="py-6 text-center text-sm text-mute">회차가 없어요. 위에서 날짜와 시간을 정해 추가해 주세요.</p>}
          {bulk}
          {selAll}
          <ul className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">{list.map((x) => <SessionRow key={x.id} show={show} s={x} run={run} picked={picked.has(x.id)} onPick={(v) => togglePick(x.id, v)} />)}</ul>
        </>
      )}
    </Sec>
  );
}
