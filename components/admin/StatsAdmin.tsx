"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ghost } from "./shared";

interface Stats {
  today_date: string; today: number; yesterday: number; month: number; total: number;
  daily: { d: string; v: number }[]; // 최근 90일, 최신 날짜가 앞
  shows: { id: string; title: string | null; views: number }[]; // 조회 수 내림차순
}
const nf = (n: number) => n.toLocaleString("ko-KR");
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dow = (d: string) => DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
const md = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-3">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{nf(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-mute">{sub}</p>}
    </div>
  );
}

/** 막대 그래프(외부 라이브러리 없이 SVG). 날짜는 오래된 것 → 최신 순. */
function Bars({ data, label }: { data: { d: string; v: number }[]; label: string }) {
  const W = 600, H = 150, padB = 18, top = 8;
  const max = Math.max(1, ...data.map((x) => x.v));
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="currentColor" className="text-line" />
      {data.map((x, i) => {
        const h = x.v === 0 ? 0 : Math.max(2, ((H - padB - top) * x.v) / max);
        return (
          <g key={x.d}>
            <rect x={i * bw + bw * 0.12} y={H - padB - h} width={bw * 0.76} height={h} rx="1.5" fill="var(--brand)">
              <title>{`${x.d} (${dow(x.d)}) · ${nf(x.v)}회`}</title>
            </rect>
          </g>
        );
      })}
      <text x="0" y={H - 4} fontSize="11" fill="currentColor" className="text-mute">{md(data[0].d)}</text>
      <text x={W} y={H - 4} fontSize="11" textAnchor="end" fill="currentColor" className="text-mute">{md(data[data.length - 1].d)}</text>
      <text x={W} y="10" fontSize="11" textAnchor="end" fill="currentColor" className="text-mute">최대 {nf(max)}</text>
    </svg>
  );
}

export default function StatsAdmin() {
  const db = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 30>(7);
  const [allDays, setAllDays] = useState(false);
  const [allShows, setAllShows] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const { data, error } = await db.rpc("get_pageview_stats");
    if (error) {
      const missing = error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message);
      setErr(missing ? "통계 표가 아직 없어요. Supabase SQL Editor에서 0010_pageviews.sql을 한 번 실행해 주세요." : "통계를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setStats(null);
    } else setStats(data as Stats);
    setLoading(false);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const series = useMemo(() => (stats ? stats.daily.slice(0, range).reverse() : []), [stats, range]);
  const rangeSum = series.reduce((n, x) => n + x.v, 0);
  const days = stats ? (allDays ? stats.daily : stats.daily.slice(0, 14)) : [];
  const rank = stats ? (allShows ? stats.shows : stats.shows.slice(0, 10)) : [];

  return (
    <section aria-label="방문자 통계" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">방문자 통계</h2>
          <p className="mt-1 text-xs text-mute">페이지를 열 때마다 1회로 세요(한국 시간 기준). 방문자를 구분하는 값은 저장하지 않아서 순방문자 수는 알 수 없어요. 관리자 접속과 봇으로 보이는 요청은 제외해요.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className={`${ghost} shrink-0 whitespace-nowrap`} aria-label="새로 고침"><RefreshCw size={14} aria-hidden className={loading ? "animate-spin" : ""} />새로 고침</button>
      </div>

      {err && <p role="alert" className="rounded-xl border border-brand bg-hit p-3 text-sm">{err}</p>}
      {loading && !stats && !err && <p className="text-sm text-mute" aria-live="polite">불러오는 중…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="페이지뷰 요약">
            <Tile label="오늘 페이지뷰" value={stats.today} sub={stats.today_date} />
            <Tile label="어제 페이지뷰" value={stats.yesterday} />
            <Tile label="이번 달 누적" value={stats.month} sub={`${stats.today_date.slice(0, 4)}년 ${Number(stats.today_date.slice(5, 7))}월`} />
            <Tile label="전체 누적" value={stats.total} />
          </div>

          <div className="rounded-xl border border-line bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">페이지뷰 추이 <span className="font-normal text-mute">· 최근 {range}일 합계 {nf(rangeSum)}</span></h3>
              <div role="group" aria-label="기간" className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
                {([7, 30] as const).map((n) => (
                  <button key={n} aria-pressed={range === n} onClick={() => setRange(n)} className={`min-h-[40px] px-3 font-medium ${range === n ? "bg-brand text-onbrand" : "bg-card text-mute"}`}>{n}일</button>
                ))}
              </div>
            </div>
            <Bars data={series} label={`최근 ${range}일 일별 페이지뷰 막대 그래프`} />
          </div>

          <div className="rounded-xl border border-line bg-card p-3">
            <h3 className="mb-2 text-sm font-bold">날짜별 페이지뷰</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-mute"><tr><th scope="col" className="py-1 font-medium">날짜</th><th scope="col" className="py-1 text-right font-medium">페이지뷰</th></tr></thead>
              <tbody>
                {days.map((x) => (
                  <tr key={x.d} className="border-t border-line">
                    <td className="py-1.5">{x.d} <span className="text-mute">({dow(x.d)})</span>{x.d === stats.today_date && <span className="ml-1.5 rounded bg-hit px-1.5 py-0.5 text-xs font-bold text-brand">오늘</span>}</td>
                    <td className="py-1.5 text-right tabular-nums">{nf(x.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.daily.length > 14 && (
              <button onClick={() => setAllDays((v) => !v)} className={`${ghost} mt-2 w-full justify-center`}>{allDays ? "최근 14일만 보기" : `최근 ${stats.daily.length}일 모두 보기`}</button>
            )}
          </div>

          <div className="rounded-xl border border-line bg-card p-3">
            <h3 className="mb-2 text-sm font-bold">가장 많이 본 공연 {allShows ? "전체 순위" : "TOP 10"}</h3>
            {stats.shows.length === 0 ? <p className="text-sm text-mute">등록된 공연이 없어요.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-mute"><tr><th scope="col" className="w-10 py-1 font-medium">순위</th><th scope="col" className="py-1 font-medium">공연</th><th scope="col" className="py-1 text-right font-medium">조회 수</th></tr></thead>
                <tbody>
                  {rank.map((s, i) => (
                    <tr key={s.id} className="border-t border-line align-top">
                      <td className="py-1.5 tabular-nums text-mute">{i + 1}</td>
                      <td className="min-w-0 break-words py-1.5 pr-2 [overflow-wrap:anywhere]">{s.title ?? <span className="text-mute">삭제된 공연 ({s.id.slice(0, 8)})</span>}</td>
                      <td className="py-1.5 text-right tabular-nums">{nf(s.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {stats.shows.length > 10 && (
              <button onClick={() => setAllShows((v) => !v)} className={`${ghost} mt-2 w-full justify-center`}>{allShows ? "TOP 10만 보기" : `전체 ${stats.shows.length}개 공연 순위 보기`}</button>
            )}
            <p className="mt-2 text-xs text-mute">공연 상세 페이지를 연 횟수예요. 백업 복원으로 공연이 새로 만들어지면 이전 공연의 조회 수는 &lsquo;삭제된 공연&rsquo;으로 남아요.</p>
          </div>
        </>
      )}
    </section>
  );
}
