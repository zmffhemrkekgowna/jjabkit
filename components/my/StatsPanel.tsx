"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Drama, Ticket, Trash2, Users, type LucideIcon } from "lucide-react";
import { recId, unlinkedOf, useWatched } from "@/lib/watched";
import { UNCLASSIFIED, computeStats, type Count } from "@/lib/stats";

/** 관극 대시보드 팔레트: 채도를 낮춘 파스텔. 버건디(브랜드색)는 '가장 많이'·1위 같은 포인트에만 써요. */
const LAV = "#A99AE8", SKY = "#8DBCEB", MINT = "#83CBB5", PEACH = "#F2A98B", YEL = "#EBCB75";
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 순위 막대: 1~3위는 서로 다른 파스텔, 나머지는 같은 계열의 연한 색. 1위 번호만 브랜드색이에요. */
function GenreBars({ rows }: { rows: Count[] }) {
  const m = Math.max(1, ...rows.map((r) => r.count));
  const colorOf = (l: string) => (l === "뮤지컬" ? LAV : l === "연극" ? SKY : l === "콘서트" ? PEACH : "var(--mute)");
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} data-genre={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 font-semibold">{r.label}</span>
          <span className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: tint(colorOf(r.label), 14) }}>
            <span className="block h-full rounded-full" style={{ width: `${(r.count / m) * 100}%`, background: colorOf(r.label) }} />
          </span>
          <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{r.count}<span className="text-xs font-normal text-mute">회</span></span>
        </li>
      ))}
    </ul>
  );
}

function RankBars({ rows, unit = "회", colors }: { rows: Count[]; unit?: string; colors: [string, string, string] }) {
  const m = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const c = i < 3 ? colors[i] : colors[0];
        return (
          <li key={r.label} className="flex items-center gap-2 text-sm">
            <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${i === 0 ? "bg-brand text-onbrand" : "text-ink"}`}
              style={i === 0 ? undefined : { background: tint(c, i < 3 ? 38 : 20) }}>{i + 1}</span>
            <span className={`w-20 shrink-0 truncate sm:w-36 ${i < 3 ? "font-semibold" : ""}`} title={r.label}>{r.label}</span>
            <span className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: tint(c, 14) }}>
              <span className="block h-full rounded-full" style={{ width: `${(r.count / m) * 100}%`, background: i < 3 ? `linear-gradient(90deg, ${c}, ${tint(c, 70)})` : tint(c, 55) }} />
            </span>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{r.count}<span className="text-xs font-normal text-mute">{unit}</span></span>
          </li>
        );
      })}
    </ol>
  );
}

const YEAR_COLORS = [LAV, SKY, MINT, PEACH, YEL];
/** 연도별 누적: 연도마다 다른 파스텔 + 부드러운 그라데이션. 가장 많이 본 해만 굵게 보여요. */
function YearBars({ rows }: { rows: Count[] }) {
  const m = Math.max(1, ...rows.map((r) => r.count));
  const top = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const c = YEAR_COLORS[i % YEAR_COLORS.length];
        return (
          <li key={r.label} className="flex items-center gap-3 text-sm">
            <span className={`w-12 shrink-0 tabular-nums ${r.count === top ? "font-bold" : "text-mute"}`}>{r.label}</span>
            <span className="h-5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: tint(c, 14) }}>
              <span className="block h-full rounded-full" style={{ width: `${(r.count / m) * 100}%`, minWidth: r.count ? 8 : 0, background: `linear-gradient(90deg, ${tint(c, 55)}, ${c})` }} />
            </span>
            <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{r.count}<span className="text-xs font-normal text-mute">회</span></span>
          </li>
        );
      })}
    </ul>
  );
}

function StatCard({ label, value, unit, color, Icon, className = "" }: { label: string; value: number; unit: string; color: string; Icon: LucideIcon; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line p-4 ${className}`} style={{ background: `linear-gradient(135deg, ${tint(color, 30)}, ${tint(color, 8)})` }}>
      <span aria-hidden className="absolute -right-3 -top-3 h-14 w-14 rounded-full" style={{ background: tint(color, 35) }} />
      <span aria-hidden className="relative mb-2 grid h-8 w-8 place-items-center rounded-xl text-ink" style={{ background: tint(color, 55) }}><Icon size={16} /></span>
      <p className="relative text-xs font-medium text-mute">{label}</p>
      <p className="relative mt-0.5 text-3xl font-extrabold leading-none tabular-nums">{value}<span className="ml-0.5 text-sm font-medium text-mute">{unit}</span></p>
    </div>
  );
}
const card = "rounded-2xl border border-line bg-card p-4";

/** 관극 통계: '관극 완료'로 직접 표시한 회차만 세요. 관심 배우의 출연 일정이나 예정 일정은 들어가지 않아요. */
export default function StatsPanel({ shows = [] }: { shows?: { id: string; title: string; genre?: string; sessions?: { id: string; date: string; time: string }[] }[] }) {
  const w = useWatched();
  const [year, setYear] = useState<string | "all">("");
  const [ask, setAsk] = useState<string | null>(null);
  // 펼친 달(YYYY-MM). 처음엔 모두 접혀 있고, 여러 달을 동시에 펼칠 수 있어요. 저장하지 않아요.
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const toggleMonth = (k: string) => setOpenMonths((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const genreByShowId = useMemo(() => new Map(shows.filter((s) => s.genre).map((s) => [s.id, s.genre as string])), [shows]);
  const all = useMemo(() => computeStats(w.records, "all", genreByShowId), [w.records, genreByShowId]);
  const y = year && (year === "all" || all.years.includes(year)) ? year : all.years[0] ?? "all";
  const st = useMemo(() => computeStats(w.records, y, genreByShowId), [w.records, y, genreByShowId]);
  const unlinked = useMemo(() => unlinkedOf(w.records, shows), [w.records, shows]);

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
      {unlinked.length > 0 && (
        <p role="note" className="rounded-xl border border-line bg-bg p-3 text-xs text-mute">
          현재 공연 데이터에서 회차를 찾지 못한 기록 {unlinked.length}개가 있어요. 통계에는 그대로 들어가고, 지우지 않고 보관하고 있어요. 공연 데이터가 다시 등록되면 자동으로 이어져요. 아래 기록 목록의 <b>회차 미연결</b> 표시로 확인할 수 있어요.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={y === "all" ? "전체 관극" : `${y}년 관극`} value={st.total} unit="회" color={LAV} Icon={Ticket} />
        <StatCard label="본 공연" value={st.byShow.length} unit="개" color={SKY} Icon={Drama} />
        <StatCard label="만난 배우" value={st.byActor.length} unit="명" color={MINT} Icon={Users} className="col-span-2 sm:col-span-1" />
      </div>

      {y !== "all" && (() => {
        const mx = Math.max(...st.monthly);
        const peak = mx > 0 ? st.monthly.indexOf(mx) : -1; // 가장 많이 본 달(같으면 앞선 달)
        return (
          <section className={card} aria-label="월별 관극 횟수">
            <h3 className="mb-3 font-bold">{y}년 월별 관극 횟수 · 추이</h3>
            <div className="flex h-36 items-end gap-1 sm:gap-2" role="img" aria-label={months.map((m) => `${m.label} ${m.count}회`).join(", ")}>
              {months.map((m, i) => (
                <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className={`text-xs tabular-nums ${i === peak ? "rounded-full bg-brand px-1.5 font-bold text-onbrand" : m.count ? "font-semibold text-ink" : "text-transparent"}`}>{m.count || 0}</span>
                  <span className="w-full rounded-t-lg" data-bar={i === peak ? "peak" : m.count ? "on" : "off"}
                    style={{ height: `${(m.count / Math.max(1, mx)) * 78}%`, minHeight: m.count ? 6 : 4,
                      background: i === peak ? "var(--brand)" : m.count ? `linear-gradient(180deg, ${LAV}, ${SKY})` : "var(--line)", opacity: m.count || i === peak ? 1 : 0.7 }} />
                  <span className={`text-[11px] tabular-nums ${i === peak ? "font-bold text-brand" : "text-mute"}`}>{m.label.replace("월", "")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full px-2.5 py-1" style={{ background: tint(MINT, 30) }}>연내 누적 <b className="tabular-nums">{st.cumulative[11]}회</b></span>
              {peak >= 0 && <span className="rounded-full px-2.5 py-1" style={{ background: tint(PEACH, 30) }}>가장 많이 본 달 <b>{months[peak].label}</b> <span className="tabular-nums">({mx}회)</span></span>}
            </div>
          </section>
        );
      })()}

      <section className={card} aria-label="연도별 누적">
        <h3 className="mb-3 font-bold">연도별 누적 관극 횟수</h3>
        <YearBars rows={all.yearTotals} />
      </section>
      <section className={card} aria-label="장르별 관극 횟수" data-testid="genre-stats">
        <h3 className="mb-3 font-bold">장르별{y === "all" ? "" : ` · ${y}년`}</h3>
        <GenreBars rows={st.byGenre} />
        {st.byGenre.some((g) => g.label === UNCLASSIFIED) && <p className="mt-2 text-xs text-mute">미분류는 공연이 삭제돼 장르를 알 수 없는 예전 기록이에요. 전체 관극 횟수에는 포함돼요.</p>}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-label="공연별 관극 횟수"><h3 className="mb-3 font-bold">공연별</h3><RankBars rows={st.byShow.slice(0, 10)} colors={[LAV, SKY, MINT]} />{st.byShow.length > 10 && <p className="mt-2 text-xs text-mute">상위 10개만 보여요 (전체 {st.byShow.length}개)</p>}</section>
        <section className={card} aria-label="배우별 관극 횟수"><h3 className="mb-3 font-bold">배우별</h3>{st.byActor.length ? <RankBars rows={st.byActor.slice(0, 10)} colors={[PEACH, YEL, MINT]} /> : <p className="text-sm text-mute">출연 배우가 정해진 회차의 기록이 아직 없어요.</p>}{st.byActor.length > 10 && <p className="mt-2 text-xs text-mute">상위 10명만 보여요 (전체 {st.byActor.length}명)</p>}</section>
      </div>

      <section className={card} aria-label="관극 기록">
        <h3 className="mb-2 font-bold">관극 기록 {y === "all" ? w.records.length : st.total}회</h3>
        {(() => {
          const rows = w.records.filter((r) => y === "all" || r.date.startsWith(y)).slice().reverse(); // 최신이 위
          const byMonth = new Map<string, typeof rows>();
          for (const r of rows) { const mk = r.date.slice(0, 7); byMonth.set(mk, [...(byMonth.get(mk) ?? []), r]); }
          const monthKeys = [...byMonth.keys()].sort().reverse();
          const years = [...new Set(monthKeys.map((k) => k.slice(0, 4)))];
          const renderRow = (r: (typeof rows)[number]) => {
            const k = recId(r);
            const dt = new Date(`${r.date}T00:00:00`);
            const wd = Number.isNaN(dt.getTime()) ? "" : WEEK[dt.getDay()];
            return (
              <li key={k} className="flex items-center gap-3 py-3">
                  <span className="w-[4.25rem] shrink-0 rounded-xl py-1.5 text-center" style={{ background: tint(LAV, 22) }}>
                    {y === "all" && <span className="block text-[10px] leading-none tabular-nums text-mute">{r.date.slice(0, 4)}</span>}
                    <b className="block text-base leading-tight tabular-nums">{r.date.slice(5).replace("-", ".")}</b>
                    <span className="block text-[11px] leading-tight tabular-nums text-mute">{wd && `${wd} · `}{r.time}</span>
                  </span>
                  <span className="sr-only">{r.date} {r.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{r.show}{unlinked.includes(r) && <span className="ml-1 rounded border border-line px-1 text-[10px] font-normal text-mute">회차 미연결</span>}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-mute [overflow-wrap:anywhere]">{r.actors.join(" · ") || "출연진 정보 없음"}</span>
                  </span>
                  {ask === k
                    ? <><button onClick={() => { w.removeRecord(r); setAsk(null); }} className="min-h-[44px] rounded-lg bg-brand px-3 text-sm font-bold text-onbrand">기록 삭제</button><button onClick={() => setAsk(null)} className="min-h-[44px] rounded-lg border border-line px-3 text-sm">취소</button></>
                    : <button onClick={() => setAsk(k)} aria-label={`${r.date} ${r.show} 관극 기록 삭제`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-mute opacity-60 hover:text-brand hover:opacity-100 focus-visible:opacity-100"><Trash2 size={15} aria-hidden /></button>}
                </li>
            );
          };
          const month = (mk: string) => {
            const list = byMonth.get(mk)!;
            const isOpen = openMonths.has(mk);
            const id = `rec-month-${mk}`;
            return (
              <li key={mk} className="rounded-xl border border-line" data-month={mk}>
                <button type="button" onClick={() => toggleMonth(mk)} aria-expanded={isOpen} aria-controls={id}
                  className="flex min-h-[48px] w-full items-center gap-2 rounded-xl px-3 text-left"
                  style={{ background: tint(LAV, isOpen ? 22 : 12) }}>
                  <span className="font-bold">{Number(mk.slice(5))}월</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ background: tint(LAV, 35) }}>{list.length}회</span>
                  <ChevronDown size={18} aria-hidden className={`ml-auto shrink-0 text-mute transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div id={id} role="region" aria-label={`${mk.slice(0, 4)}년 ${Number(mk.slice(5))}월 관극 기록`} inert={!isOpen}
                  className={`grid transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none ${isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden">
                    <ul className="divide-y divide-line px-3 text-sm">{list.map(renderRow)}</ul>
                  </div>
                </div>
              </li>
            );
          };
          return y === "all" ? (
            <div className="space-y-4">
              {years.map((yr) => {
                const ks = monthKeys.filter((k) => k.startsWith(yr));
                return (
                  <div key={yr} data-year={yr}>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><span>{yr}년</span><span className="text-xs font-normal text-mute tabular-nums">{ks.reduce((n, k) => n + byMonth.get(k)!.length, 0)}회</span><span aria-hidden className="h-px flex-1 bg-line" /></h4>
                    <ul className="space-y-2">{ks.map(month)}</ul>
                  </div>
                );
              })}
            </div>
          ) : <ul className="space-y-2">{monthKeys.map(month)}</ul>;
        })()}
        <p className="mt-2 text-xs text-mute">기록을 지워도 내 일정은 그대로예요.</p>
      </section>
    </div>
  );
}
