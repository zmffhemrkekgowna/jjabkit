"use client";

import UserDataSync from "./UserDataSync";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import type { Genre, Show } from "@/types/show";
import { statusOf, type ShowStatus } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import { useFavorites } from "@/lib/favorites";
import { HeartButton } from "./ui/HeartButton";
import { StatusTag } from "./ui/Tags";
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

/** 포스터 주소가 있는 공연만 작은 그림을 보여줘요. 없거나 못 불러오면 아무것도 그리지 않아요(임의의 그림을 만들지 않아요). */
function Thumb({ show }: { show: Show }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [show.img]);
  if (!show.img || bad) return null;
  return (
    <span className="my-2 ml-3 block h-14 w-10 shrink-0 overflow-hidden rounded-md border border-line bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={show.img} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />
    </span>
  );
}

/** 최근 본 공연: 옆으로 밀 수 있으면 오른쪽 끝이 흐려지고, 비어 있으면 안내가 나와요. 지우기는 한 번 더 확인해요. */
function RecentStrip({ shows, onClear }: { shows: Show[]; onClear: () => void }) {
  const ref = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setMore(el.scrollWidth > el.clientWidth + el.scrollLeft + 4);
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    return () => { el.removeEventListener("scroll", upd); window.removeEventListener("resize", upd); };
  }, [shows]);
  return (
    <section aria-label="최근 본 공연" className="mb-4 rounded-2xl border border-line bg-card px-3 pb-2 pt-1">
      <div className="flex min-h-[44px] items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-mute">최근 본 공연</h2>
        {shows.length > 0 && (ask ? (
          <span className="flex items-center gap-1 text-xs" role="group" aria-label="기록 지우기 확인">
            <span className="text-mute">기록을 지울까요?</span>
            <button onClick={() => { onClear(); setAsk(false); }} className="min-h-[44px] rounded-md px-2 font-bold text-brand">지우기</button>
            <button onClick={() => setAsk(false)} className="min-h-[44px] rounded-md px-2 text-mute">취소</button>
          </span>
        ) : <button onClick={() => setAsk(true)} className="min-h-[44px] px-2 text-xs text-mute underline">기록 지우기</button>)}
      </div>
      {shows.length === 0 ? (
        <p className="pb-2 text-sm text-mute">아직 본 공연이 없어요. 공연을 열어 보면 여기에 쌓여요.</p>
      ) : (
        <div className="relative">
          <ul ref={ref} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            {shows.map((s) => (
              <li key={s.id} className="shrink-0"><Link href={`/shows/${s.id}`} title={s.title} className="block max-w-[11rem] truncate rounded-full border border-line bg-bg px-3 py-2.5 text-sm hover:border-brand">{s.title}</Link></li>
            ))}
          </ul>
          {more && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--card)] to-transparent" />}
        </div>
      )}
    </section>
  );
}

/** 메인: 공연 리스트. 회차·캐스트는 '오늘' 탭과 공연 상세에서 봐요. */
export default function ShowList({ shows }: { shows: Show[] }) {
  const fav = useFavorites();
  const today = useTodayKST(); // 자정이 지나면 상태 탭 분류도 저절로 바뀌어요
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

  const rowLabel = "w-8 shrink-0 text-[11px] font-bold text-mute";
  const scroller = "flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <UserDataSync shows={shows} />
      {/* 모바일에서는 키보드가 올라와도 가리지 않게 고정하지 않아요 */}
      <header className="z-30 border-b border-line bg-bg sm:sticky sm:top-11">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={reset} aria-label="JJabKit 홈" className="flex shrink-0 items-baseline gap-1">
            <span className="font-serif text-xl font-bold text-brand sm:text-2xl">JJabKit</span>
            <span className="hidden text-[11px] font-medium text-mute min-[400px]:inline">짭킷</span>
          </button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><Search size={18} aria-hidden /></span>
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="공연명, 배우, 장르 검색" aria-label="공연 검색" enterKeyHint="search"
              className="min-h-[44px] w-full rounded-full border border-line bg-card py-2 pl-10 pr-11 text-base focus:border-brand sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
            />
            {q && <button onClick={() => setQ("")} aria-label="검색어 지우기" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-mute"><X size={18} aria-hidden /></button>}
          </div>
        </div>
        <HomeTabs active="list" />
      </header>

      <main className="px-4 pt-4">
        {/* 필터: 장르는 알약 모양, 상태는 묶음 모양으로 구분해요. 좁은 화면에서는 줄 안에서 옆으로 밀어요. */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={rowLabel}>장르</span>
            <div className={scroller} role="group" aria-label="카테고리">
              {CATS.map((c) => (
                <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}
                  className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium sm:min-h-[36px] ${cat === c ? "border-brand bg-brand text-onbrand" : "border-line bg-card text-mute hover:border-brand hover:text-brand"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={rowLabel}>상태</span>
            <div className={scroller}>
              <div className="inline-flex shrink-0 rounded-xl border border-line bg-card p-0.5" role="group" aria-label="상태">
                {STATUS.map((t) => (
                  <button key={t.v} aria-pressed={st === t.v} onClick={() => setSt(t.v)}
                    className={`min-h-[40px] whitespace-nowrap rounded-[10px] px-3 text-sm font-medium sm:min-h-[32px] ${st === t.v ? "bg-brand text-onbrand" : "text-mute hover:text-brand"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-mute">공연 <b className="text-ink">{rows.length}</b>개</p>
          <div className="flex items-center gap-2">
            {filtering && <button onClick={reset} className="min-h-[44px] px-2 text-sm text-mute underline sm:min-h-0">필터 초기화</button>}
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬" className="min-h-[44px] rounded-lg border border-line bg-card px-2 text-sm sm:min-h-0 sm:py-1.5">
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {!filtering && <RecentStrip shows={recentShows} onClear={recent.clear} />}

        {rows.length > 0 ? (
          <ul aria-label="공연 목록" className="divide-y divide-line border-y border-line lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 lg:border-0">
            {rows.map(({ show: s, actors }) => (
              <li key={s.id} className="flex items-stretch lg:overflow-hidden lg:rounded-xl lg:border lg:border-line lg:bg-card">
                <Link href={`/shows/${s.id}`} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-2 py-3 pl-1 pr-2 hover:text-brand lg:pl-3">
                  <Thumb show={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-bold leading-snug"><Hit text={s.title} q={q} /></span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-mute">
                      <StatusTag status={statusOf(s, today)} />
                      <span>{s.genre}</span>
                    </span>
                    {actors.length > 0 && (
                      <span className="mt-1 block break-words text-xs font-normal text-mute" aria-label="검색과 일치한 배우">
                        {actors.slice(0, 3).map((a, i) => (
                          <Fragment key={a.name + a.role}>{i > 0 && " · "}<Hit text={a.name} q={q} /> <span className="opacity-80">({a.role})</span></Fragment>
                        ))}
                        {actors.length > 3 && ` 외 ${actors.length - 3}명`}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-mute" aria-hidden />
                </Link>
                {/* 하트는 링크 바깥의 따로 된 칸이라 눌림이 섞이지 않아요 */}
                <div className="flex w-14 shrink-0 items-center justify-center border-l border-line">
                  <HeartButton on={fav.shows.has(s.id)} onClick={() => fav.toggleShow(s.id)} label={s.title} className="h-11 w-11" />
                </div>
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
