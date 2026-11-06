"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useWatched } from "@/lib/watched";
import { computeStats, type Count } from "@/lib/stats";

function Bars({ rows, unit = "회", max }: { rows: Count[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 truncate sm:w-40" title={r.label}>{r.label}</span>
          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-bg"><span className="block h-full rounded-full bg-brand" style={{ width: `${(r.count / m) * 100}%` }} /></span>
          <span className="w-10 shrink-0 text-right tabular-nums text-mute">{r.count}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
const card = "rounded-2xl border border-line bg-card p-4";

/** 관극 통계: '관극 완료'로 직접 표시한 회차만 세요. 관심 배우의 출연 일정이나 예정 일정은 들어가지 않아요. */
export default function StatsPanel() {
  const w = useWatched();
  const [year, setYear] = useState<string | "all">("");
  const [ask, setAsk] = useState<string | null>(null);
  const all = useMemo(() => computeStats(w.records, "all"), [w.records]);
  const y = year && (year === "all" || all.years.includes(year)) ? year : all.years[0] ?? "all";
  const st = useMemo(() => computeStats(w.records, y), [w.records, y]);

  if (w.records.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center">
        <p className="font-medium">아직 관극 완료로 표시한 공연이 없어요.</p>
        <p className="mt-1 text-sm text-mute">‘내 일정’에서 이미 본 회차를 열고 ‘관극 완료로 표시’를 누르면 여기에 통계가 쌓여요. 표시하지 않은 일정은 세지 않아요.</p>
        <Link href="/my?tab=sched" className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-brand px-4 text-sm font-bold text-brand">내 일정으로</Link>
      </div>
    );
  }
  const months = st.monthly.map((n, i) => ({ label: `${i + 1}월`, count: n }));
  const cumMax = Math.max(1, ...st.cumulative);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="기간">
        {[...all.years, "all"].map((v) => (
          <button key={v} aria-pressed={y === v} onClick={() => setYear(v)}
            className={`min-h-[40px] rounded-full border px-3 text-sm ${y === v ? "border-brand bg-brand font-bold text-onbrand" : "border-line text-mute"}`}>{v === "all" ? "전체" : `${v}년`}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={card}><p className="text-xs text-mute">{y === "all" ? "전체 관극" : `${y}년 관극`}</p><p className="text-2xl font-bold text-brand tabular-nums">{st.total}<span className="text-sm text-mute">회</span></p></div>
        <div className={card}><p className="text-xs text-mute">본 공연</p><p className="text-2xl font-bold tabular-nums">{st.byShow.length}<span className="text-sm text-mute">개</span></p></div>
        <div className={`${card} col-span-2 sm:col-span-1`}><p className="text-xs text-mute">만난 배우</p><p className="text-2xl font-bold tabular-nums">{st.byActor.length}<span className="text-sm text-mute">명</span></p></div>
      </div>

      {y !== "all" && (
        <section className={card} aria-label="월별 관극 횟수">
          <h3 className="mb-2 font-bold">{y}년 월별 관극 횟수 · 추이</h3>
          <div className="flex h-32 items-end gap-1 sm:gap-2" role="img" aria-label={months.map((m) => `${m.label} ${m.count}회`).join(", ")}>
            {months.map((m) => (
              <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-mute">{m.count || ""}</span>
                <span className="w-full rounded-t bg-brand" style={{ height: `${(m.count / Math.max(1, ...st.monthly)) * 80}%`, minHeight: m.count ? 4 : 0 }} />
                <span className="text-[10px] text-mute">{m.label.replace("월", "")}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">연내 누적 {st.cumulative[11]}회 · 가장 많이 본 달 {months.reduce((a, b) => (b.count > a.count ? b : a)).label}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg" aria-hidden><span className="block h-full bg-brand" style={{ width: `${(st.cumulative[11] / cumMax) * 100}%` }} /></div>
        </section>
      )}

      <section className={card} aria-label="연도별 누적">
        <h3 className="mb-2 font-bold">연도별 누적 관극 횟수</h3>
        <Bars rows={all.yearTotals} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-label="공연별 관극 횟수"><h3 className="mb-2 font-bold">공연별</h3><Bars rows={st.byShow.slice(0, 10)} />{st.byShow.length > 10 && <p className="mt-2 text-xs text-mute">상위 10개만 보여요 (전체 {st.byShow.length}개)</p>}</section>
        <section className={card} aria-label="배우별 관극 횟수"><h3 className="mb-2 font-bold">배우별</h3>{st.byActor.length ? <Bars rows={st.byActor.slice(0, 10)} /> : <p className="text-sm text-mute">출연 배우가 정해진 회차의 기록이 아직 없어요.</p>}{st.byActor.length > 10 && <p className="mt-2 text-xs text-mute">상위 10명만 보여요 (전체 {st.byActor.length}명)</p>}</section>
      </div>

      <section className={card} aria-label="관극 기록">
        <h3 className="mb-2 font-bold">관극 기록 {y === "all" ? w.records.length : st.total}회</h3>
        <ul className="divide-y divide-line text-sm">
          {w.records.filter((r) => y === "all" || r.date.startsWith(y)).slice().reverse().map((r) => {
            const k = `${r.show}|${r.date}|${r.time}`;
            return (
              <li key={k} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1"><b className="tabular-nums">{r.date} {r.time}</b> · {r.show}<span className="block truncate text-xs text-mute">{r.actors.join(" · ") || "출연진 정보 없음"}</span></span>
                {ask === k
                  ? <><button onClick={() => { w.unmark(r); setAsk(null); }} className="min-h-[44px] rounded-lg bg-brand px-3 text-sm font-bold text-onbrand">기록 삭제</button><button onClick={() => setAsk(null)} className="min-h-[44px] rounded-lg border border-line px-3 text-sm">취소</button></>
                  : <button onClick={() => setAsk(k)} aria-label={`${r.date} ${r.show} 관극 기록 삭제`} className="grid h-11 w-11 place-items-center rounded-lg text-mute hover:text-brand"><Trash2 size={15} aria-hidden /></button>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-mute">기록을 지워도 내 일정은 그대로예요.</p>
      </section>
    </div>
  );
}
