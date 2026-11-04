"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import type { Genre, Show } from "@/types/show";
import { statusOf, type ShowStatus } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import { useFavorites } from "@/lib/favorites";
import { HeartButton } from "./ui/HeartButton";
import HomeTabs from "./HomeTabs";
import AdSenseBanner from "./ads/AdSenseBanner";
import { ADSENSE_SLOT_LIST } from "@/lib/ads";
import { searchShows, sortShows, splitHit, SORTS, type SortKey } from "@/lib/search";
import { useRecent } from "@/lib/recent";

function Hit({ text, q }: { text: string; q: string }) {
  const [a, m, b] = splitHit(text, q);
  return <>{a}{m && <mark className="rounded-sm bg-hit px-0.5 font-bold text-brand">{m}</mark>}{b}</>;
}

const CATS: ("전체" | Genre)[] = ["전체", "뮤지컬", "연극"];
const STATUS: { v: "전체" | ShowStatus; label: string }[] = [
  { v: "전체", label: "전체" }, { v: "running", label: "공연 중" }, { v: "upcoming", label: "개막 예정" }, { v: "ended", label: "종료" },
];

/** 메인: 공연명만 보여 주는 세로 리스트. 회차·캐스트는 '오늘' 탭과 공연 상세에서 봐요. */
export default function ShowList({ shows }: { shows: Show[] }) {
  const fav = useFavorites();
  const today = useTodayKST(); // 자정이 지나면 상태 탭 분류도 저절로 바뀌어요
  const { ready, pruneShows } = fav;
  useEffect(() => { if (ready && shows.length > 0) pruneShows(new Set(shows.map((s) => s.id))); }, [ready, pruneShows, shows]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"전체" | Genre>("전체");
  const [st, setSt] = useState<"전체" | ShowStatus>("전체");

  const [sort, setSort] = useState<SortKey>("default");
  const rows = useMemo(() => {
    const found = searchShows(shows, q).filter(({ show: s }) => (cat === "전체" || s.genre === cat) && (st === "전체" || statusOf(s, today) === st));
    return sortShows(found, sort);
  }, [shows, q, cat, st, sort, today]);
  const validIds = useMemo(() => new Set(shows.map((s) => s.id)), [shows]);
  const recent = useRecent(validIds);
  const recentShows = recent.ids.map((id) => shows.find((s) => s.id === id)).filter((s): s is Show => !!s);
  const filtering = q.trim() !== "" || cat !== "전체" || st !== "전체";
  const reset = () => { setQ(""); setCat("전체"); setSt("전체"); setSort("default"); };

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <header className="sticky top-11 z-30 border-b border-line bg-bg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={reset} aria-label="JJabKit 홈" className="flex shrink-0 items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-brand">JJabKit</span>
            <span className="text-[11px] font-medium text-mute">짭킷</span>
          </button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"><Search size={16} aria-hidden /></span>
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="공연명, 배우명, 장르 검색" aria-label="공연 검색"
              className="w-full rounded-full border border-line bg-card py-2 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none"
            />
            {q && <button onClick={() => setQ("")} aria-label="검색어 지우기" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-mute"><X size={16} aria-hidden /></button>}
          </div>
        </div>
        <HomeTabs active="list" />
        <div className="flex gap-2 px-4 py-3" role="group" aria-label="카테고리">
          {CATS.map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${cat === c ? "border-brand bg-brand text-onbrand" : "border-line text-mute hover:border-brand"}`}>
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <p aria-live="polite" className="text-sm text-mute">공연 <b className="text-ink">{rows.length}</b>개</p>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬" className="min-h-[44px] rounded-lg border border-line bg-card px-2 text-sm sm:min-h-0 sm:py-1">
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="상태">
            {STATUS.map((t) => (
              <button key={t.v} aria-pressed={st === t.v} onClick={() => setSt(t.v)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${st === t.v ? "bg-ink text-bg" : "text-mute"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!filtering && recentShows.length > 0 && (
          <section aria-label="최근 본 공연" className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xs font-bold text-mute">최근 본 공연</h2>
              <button onClick={recent.clear} className="min-h-[44px] px-2 text-xs text-mute underline">기록 지우기</button>
            </div>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {recentShows.map((s) => (
                <li key={s.id} className="shrink-0"><Link href={`/shows/${s.id}`} className="block max-w-[11rem] truncate rounded-full border border-line bg-card px-3 py-2 text-sm hover:border-brand">{s.title}</Link></li>
              ))}
            </ul>
          </section>
        )}

        {rows.length > 0 ? (
          <ul aria-label="공연 목록" className="divide-y divide-line border-y border-line">
            {rows.map(({ show: s, actors }) => (
              <li key={s.id} className="relative flex items-center">
                <Link href={`/shows/${s.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-4 pr-20 font-bold hover:text-brand">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate"><Hit text={s.title} q={q} /></span>
                    {actors.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs font-normal text-mute" aria-label="검색과 일치한 배우">
                        {actors.slice(0, 3).map((a, i) => (
                          <Fragment key={a.name + a.role}>{i > 0 && " · "}<Hit text={a.name} q={q} /> <span className="opacity-80">({a.role})</span></Fragment>
                        ))}
                        {actors.length > 3 && ` 외 ${actors.length - 3}명`}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-mute" aria-hidden />
                </Link>
                <HeartButton on={fav.shows.has(s.id)} onClick={() => fav.toggleShow(s.id)} label={s.title} className="absolute right-10 top-1/2 -translate-y-1/2" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <p className="text-sm text-mute">{shows.length === 0 ? "아직 등록된 공연이 없어요." : `‘${q.trim() || "조건"}’에 맞는 공연이 없어요. 공연명이나 배우 이름의 일부만 입력해 보세요.`}</p>
            {shows.length > 0 && <button onClick={reset} className="mt-3 min-h-[44px] rounded-lg border border-line px-4 py-2 text-sm font-medium">검색 조건 초기화</button>}
          </div>
        )}
        <div className="pt-6"><AdSenseBanner slot={ADSENSE_SLOT_LIST} label="목록 하단 광고" /></div>
      </main>
    </div>
  );
}
