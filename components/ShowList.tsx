"use client";

import { Fragment, useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Genre, Show, Status } from "@/types/show";
import { useFavorites } from "@/lib/favorites";
import ShowCard from "./ShowCard";
import AdSenseBanner from "./ads/AdSenseBanner";
import { ADSENSE_SLOT_LIST } from "@/lib/ads";

/** 카드 6개(2열·3열 모두 줄이 딱 맞는 수) 뒤에 광고를 넣어요. 6개 이하면 목록 맨 아래에 둬요. */
const AD_AFTER = 6;

const CATS: ("전체" | Genre)[] = ["전체", "뮤지컬", "연극"];
const STATUS: { v: "전체" | Status; label: string }[] = [
  { v: "전체", label: "전체" }, { v: "running", label: "공연 중" }, { v: "upcoming", label: "개막 예정" },
];

export default function ShowList({ shows }: { shows: Show[] }) {
  const fav = useFavorites();
  const { ready, pruneShows } = fav;
  useEffect(() => { if (ready) pruneShows(new Set(shows.map((s) => s.id))); }, [ready, pruneShows, shows]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"전체" | Genre>("전체");
  const [st, setSt] = useState<"전체" | Status>("전체");

  const k = q.trim().toLowerCase();
  const rows = shows
    .map((s) => {
      const hit = k ? s.roles.flatMap((r) => r.actors.map((a) => a.n)).filter((n) => n.toLowerCase().includes(k)) : [];
      const ok = !k || s.title.toLowerCase().includes(k) || s.genre.includes(k) || hit.length > 0;
      return { s, hit, ok };
    })
    .filter((x) => x.ok && (cat === "전체" || x.s.genre === cat) && (st === "전체" || x.s.status === st));
  const reset = () => { setQ(""); setCat("전체"); setSt("전체"); };

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <header className="sticky top-11 z-30 border-b border-line bg-bg">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={reset} aria-label="뮤킷 홈" className="flex shrink-0 items-baseline gap-1">
            <span className="font-serif text-2xl font-bold text-brand">뮤킷</span>
            <span className="text-[11px] font-medium text-mute">Myukit</span>
          </button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"><Search size={16} aria-hidden /></span>
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="공연명, 배우명, 장르 검색" aria-label="공연 검색"
              className="w-full rounded-full border border-line bg-card py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3" role="group" aria-label="카테고리">
          {CATS.map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${cat === c ? "border-brand bg-brand text-onbrand" : "border-line text-mute hover:border-brand"}`}>
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p aria-live="polite" className="text-sm text-mute">공연 <b className="text-ink">{rows.length}</b>개</p>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="상태">
            {STATUS.map((t) => (
              <button key={t.v} aria-pressed={st === t.v} onClick={() => setSt(t.v)}
                className={`rounded-md px-3 py-1 text-sm ${st === t.v ? "bg-ink text-bg" : "text-mute"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4">
            {rows.map(({ s, hit }, i) => (
              <Fragment key={s.id}>
                <ShowCard show={s} hit={hit} />
                {i === AD_AFTER - 1 && rows.length > AD_AFTER && (
                  <AdSenseBanner slot={ADSENSE_SLOT_LIST} label="목록 중간 광고" className="col-span-full" />
                )}
              </Fragment>
            ))}
            {rows.length <= AD_AFTER && <AdSenseBanner slot={ADSENSE_SLOT_LIST} label="목록 하단 광고" className="col-span-full" />}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <p className="text-sm text-mute">
              {shows.length === 0 ? "아직 등록된 공연이 없어요." : "검색 결과가 없어요. 공연명, 배우명, 장르를 다시 확인해 보세요."}
            </p>
            {shows.length > 0 && <button onClick={reset} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">검색 조건 초기화</button>}
          </div>
        )}
      </main>
    </div>
  );
}
