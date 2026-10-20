"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Role, Session, SessionInput, Show } from "@/types/show";
import { deleteSession, saveSession } from "@/lib/db/shows";
import { Fld, Sec, btn, iconBtn, inp, type Notify, type Run } from "./shared";

const castSelect = (r: Role, value: string, onChange: (v: string) => void) => (
  <label key={r.id} className="flex items-center gap-2 text-xs text-mute">
    <span className="w-16 shrink-0 truncate">{r.name}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
      <option value="">미정</option>
      {r.actors.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}
    </select>
  </label>
);

const check = (label: ReactNode, checked: boolean, onChange: (v: boolean) => void) => (
  <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />{label}
  </label>
);

/** 등록된 회차 한 줄. 선택/체크는 바로 저장하고, 날짜·시간은 입력을 마치면(포커스 이동) 저장해요. */
function SessionRow({ show, s, run }: { show: Show; s: Session; run: Run }) {
  const [dt, setDt] = useState({ date: s.date, time: s.time });
  useEffect(() => { setDt({ date: s.date, time: s.time }); }, [s.date, s.time]);

  const save = (patch: Partial<SessionInput>) =>
    run((db) => saveSession(db, show.id, { date: s.date, time: s.time, cast: s.cast, curtain: s.curtain, timesale: s.timesale, ...patch }, s.id));
  const commitDateTime = () => { if (dt.date && dt.time && (dt.date !== s.date || dt.time !== s.time)) save(dt); };

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={dt.date} onChange={(e) => setDt({ ...dt, date: e.target.value })} onBlur={commitDateTime} aria-label="날짜" className={`${inp} !w-auto`} />
        <input type="time" value={dt.time} onChange={(e) => setDt({ ...dt, time: e.target.value })} onBlur={commitDateTime} aria-label="시간" className={`${inp} !w-auto`} />
        <button onClick={() => run((db) => deleteSession(db, s.id), "회차를 삭제했어요.")} aria-label="회차 삭제" className={`${iconBtn} ml-auto`}><Trash2 size={16} aria-hidden /></button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {show.roles.map((r) => castSelect(r, s.cast[r.id] ?? "", (v) => save({ cast: { ...s.cast, [r.id]: v } })))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {check("커튼콜 데이", s.curtain, (v) => save({ curtain: v }))}
        {check("타임세일 적용", s.timesale, (v) => save({ timesale: v }))}
      </div>
    </li>
  );
}

const BLANK = { date: "", time: "19:30", curtain: false, timesale: false, cast: {} as Record<string, string> };

export default function SessionsEditor({ show, run, notify }: { show: Show; run: Run; notify: Notify }) {
  const [dd, setDd] = useState(BLANK);
  const [filter, setFilter] = useState("");
  const date = dd.date || show.start;

  const add = () => {
    if (!date || !dd.time) return notify("날짜와 시간을 입력해 주세요.");
    const cast = Object.fromEntries(show.roles.map((r) => [r.id, dd.cast[r.id] ?? r.actors[0]?.id ?? ""]));
    run((db) => saveSession(db, show.id, { date, time: dd.time, cast, curtain: dd.curtain, timesale: dd.timesale }), `${date} ${dd.time} 회차를 추가했어요. 사용자 화면에 바로 반영돼요.`);
  };

  const list = [...show.sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).filter((x) => !filter || x.date === filter);

  return (
    <Sec title="캐스팅 스케줄">
      <div className="rounded-xl border border-line p-3">
        <p className="mb-2 text-sm font-bold">회차 추가</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Fld label="날짜"><input type="date" value={date} onChange={(e) => setDd({ ...dd, date: e.target.value })} className={inp} /></Fld>
          <Fld label="회차 시간"><input type="time" value={dd.time} onChange={(e) => setDd({ ...dd, time: e.target.value })} className={inp} /></Fld>
          {show.roles.map((r) => castSelect(r, dd.cast[r.id] ?? r.actors[0]?.id ?? "", (v) => setDd({ ...dd, cast: { ...dd.cast, [r.id]: v } })))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {check("커튼콜 데이", dd.curtain, (v) => setDd({ ...dd, curtain: v }))}
          {check("타임세일 적용", dd.timesale, (v) => setDd({ ...dd, timesale: v }))}
          <button onClick={add} className={`${btn} ml-auto`}><Plus size={14} aria-hidden />회차 추가</button>
        </div>
      </div>

      <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">등록된 회차 <span className="font-normal text-mute">{list.length}개</span></p>
        <div className="flex items-center gap-2">
          <input type="date" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="날짜로 찾기" className={`${inp} !w-auto`} />
          {filter && <button onClick={() => setFilter("")} className="text-xs text-mute underline">전체 보기</button>}
        </div>
      </div>
      {list.length === 0 && <p className="py-6 text-center text-sm text-mute">회차가 없어요. 위에서 날짜와 시간을 정해 추가해 주세요.</p>}
      <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {list.map((x) => <SessionRow key={x.id} show={show} s={x} run={run} />)}
      </ul>
    </Sec>
  );
}
