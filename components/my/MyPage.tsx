"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { myTabOf } from "../BottomNav";
import { ChevronLeft, ChevronRight, Heart, Percent, Star } from "lucide-react";
import type { Show } from "@/types/show";
import { DOW, addDays, buildIndex, fmtDate, fromKey, toKey } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { appearancesOf, buildMySchedule, showColor, type MyItem } from "@/lib/mySchedule";
import Avatar from "../ui/Avatar";
import { HeartButton } from "../ui/HeartButton";
import { CurtainTag, TimeSaleTag } from "../ui/Tags";
import ShowCard from "../ShowCard";
import SessionSheet from "../casting/SessionSheet";
import ShareBar from "../ShareBar";
import { mySchedSpec } from "@/lib/calendarImage";

type Tab = "show" | "actor" | "sched";
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-8 text-center">
      <p className="text-sm text-mute">{text}</p>
      <Link href="/" className="mt-3 inline-block rounded-lg border border-line px-3 py-1.5 text-sm font-medium">공연 보러 가기</Link>
    </div>
  );
}

export default function MyPage({ shows }: { shows: Show[] }) {
  const fav = useFavorites();
  const { ready, pruneShows } = fav;
  useEffect(() => { if (ready) pruneShows(new Set(shows.map((s) => s.id))); }, [ready, pruneShows, shows]);
  // 탭은 주소(?tab=)가 기준이에요. 하단 메뉴와 같은 값을 쓰고, 화면 안에서 탭을 눌러도 주소만 바꿔서 서버를 다시 부르지 않아요.
  const tab: Tab = myTabOf(useSearchParams().get("tab"));
  const setTab = (t: Tab) => window.history.replaceState(null, "", `?tab=${t}`);
  const [view, setView] = useState<"month" | "list">("month");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<Date>(() => firstOfMonth(new Date()));
  const [sheet, setSheet] = useState<{ showId: string; date: string; sid: string } | null>(null);

  const names = useMemo(() => [...fav.actors], [fav.actors]);
  const favShows = shows.filter((s) => fav.shows.has(s.id));
  const shown = useMemo(() => new Set(names.filter((n) => !hidden.has(n))), [names, hidden]);
  const items = useMemo(() => buildMySchedule(shows, shown), [shows, shown]);

  // 보여줄 달은 일정이 있는 범위 안으로 맞춰요
  const lo = items.length ? firstOfMonth(fromKey(items[0].session.date)) : null;
  const hi = items.length ? firstOfMonth(fromKey(items[items.length - 1].session.date)) : null;
  const cur = lo && hi ? (cursor < lo ? lo : cursor > hi ? hi : cursor) : cursor;
  const ym = toKey(cur).slice(0, 7);
  const monthItems = items.filter((i) => i.session.date.slice(0, 7) === ym);
  const byDate = new Map<string, MyItem[]>();
  monthItems.forEach((i) => byDate.set(i.session.date, [...(byDate.get(i.session.date) ?? []), i]));
  const days: Date[] = [];
  const f = firstOfMonth(cur), l = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
  for (let d = addDays(f, -f.getDay()); d <= l || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const step = (dir: -1 | 1) => setCursor(new Date(cur.getFullYear(), cur.getMonth() + dir, 1));

  const sheetShow = sheet ? shows.find((s) => s.id === sheet.showId) : undefined;
  const sheetIdx = useMemo(() => (sheetShow ? buildIndex(sheetShow) : null), [sheetShow]);
  const sheetSel = sheetShow
    ? new Set(sheetShow.roles.flatMap((r) => r.actors).filter((a) => fav.actors.has(a.n)).map((a) => a.id))
    : new Set<string>();

  const toggleHidden = (n: string) => setHidden((h) => { const c = new Set(h); if (c.has(n)) c.delete(n); else c.add(n); return c; });
  const open = (i: MyItem) => setSheet({ showId: i.show.id, date: i.session.date, sid: i.session.id });
  const seg = (on: boolean) => `rounded-md px-3 py-1 text-sm ${on ? "bg-ink text-bg" : "text-mute"}`;
  const tabs: [Tab, string][] = [["show", `관심 공연 ${favShows.length}`], ["actor", `관심 배우 ${names.length}`], ["sched", "내 일정"]];

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <header className="px-4 pb-3 pt-5">
        <h1 className="font-serif text-xl font-bold">마이페이지</h1>
        <p className="mt-1 text-xs text-mute">하트로 등록한 관심 공연과 관심 배우가 이 브라우저에 저장돼요.</p>
      </header>

      <nav role="tablist" className="sticky top-11 z-30 flex border-b border-line bg-bg px-4">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold ${tab === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
            {label}
          </button>
        ))}
      </nav>

      <main className="space-y-3 px-4 pt-4">
        {tab === "show" && (favShows.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4">
            {favShows.map((s) => <ShowCard key={s.id} show={s} />)}
          </div>
        ) : <Empty text="관심 공연이 없어요. 공연 카드나 상세 화면의 하트를 눌러 등록해 보세요." />)}

        {tab === "actor" && (names.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {names.map((n) => {
              const apps = appearancesOf(shows, n);
              return (
                <article key={n} className="rounded-2xl border border-line bg-card p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={n} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{n}</div>
                      <div className="text-xs text-mute">{apps.length > 0 ? `출연 공연 ${apps.length}개` : "현재 등록된 공연이 없어요"}</div>
                    </div>
                    <HeartButton on onClick={() => fav.toggleActor(n)} label={n} size={20} />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {apps.map((a) => (
                      <li key={a.show.id + a.roleName}>
                        <Link href={`/shows/${a.show.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-bg">
                          <span className="min-w-0 truncate">{a.show.title} · {a.roleName}</span>
                          <span className="shrink-0 text-xs text-mute">{a.count}회차</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        ) : <Empty text="관심 배우가 없어요. 공연 상세의 배우 칩 옆 하트나 회차 시트에서 등록해 보세요." />)}

        {tab === "sched" && (names.length === 0 ? (
          <Empty text="관심 배우를 등록하면 그 배우가 출연하는 모든 회차를 여기에 모아 보여줘요." />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="일정에 포함할 배우">
              {names.map((n) => (
                <button key={n} aria-pressed={!hidden.has(n)} onClick={() => toggleHidden(n)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${hidden.has(n) ? "border-line text-mute line-through" : "border-brand bg-brand text-onbrand"}`}>
                  <Heart size={12} fill={hidden.has(n) ? "none" : "currentColor"} aria-hidden />{n}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button onClick={() => step(-1)} disabled={!lo || cur <= lo} aria-label="이전 달" className="rounded-lg p-2 disabled:opacity-30"><ChevronLeft size={18} aria-hidden /></button>
                <h2 className="min-w-[8rem] text-center font-bold">{cur.getFullYear()}년 {cur.getMonth() + 1}월</h2>
                <button onClick={() => step(1)} disabled={!hi || cur >= hi} aria-label="다음 달" className="rounded-lg p-2 disabled:opacity-30"><ChevronRight size={18} aria-hidden /></button>
              </div>
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="보기 방식">
                <button aria-pressed={view === "month"} onClick={() => setView("month")} className={seg(view === "month")}>달력</button>
                <button aria-pressed={view === "list"} onClick={() => setView("list")} className={seg(view === "list")}>목록</button>
              </div>
            </div>

            {items.length > 0 && (
              <ShareBar
                build={() => mySchedSpec(items, cur, [...shown])}
                fileBase={`내일정-${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`}
                shareTitle="내 관심 배우 일정" shareText={`내 관심 배우 일정 ${cur.getFullYear()}년 ${cur.getMonth() + 1}월 (${[...shown].join(", ")})`}
              />
            )}

            <p aria-live="polite" className="text-sm text-mute">
              {items.length === 0 ? "선택한 관심 배우가 출연하는 회차가 아직 없어요." : <>이번 달 출연 <b className="text-brand">{monthItems.length}</b>회차 · 전체 {items.length}회차</>}
            </p>

            {view === "month" ? (
              <div>
                <div role="grid" aria-label="내 일정 달력" className="overflow-x-auto rounded-2xl border border-line bg-card">
                  <div className="min-w-[45.5rem]">
                    <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">
                      {DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
                      {days.map((day) => {
                        const k = toKey(day);
                        const inMonth = day.getMonth() === cur.getMonth();
                        const list = inMonth ? byDate.get(k) ?? [] : [];
                        return (
                          <div key={k} role="gridcell" className={`flex min-h-[6.5rem] min-w-0 flex-col gap-1 p-1 ${!inMonth ? "bg-bg" : list.length ? "bg-hit" : "bg-card"}`}>
                            <span className={`px-0.5 text-xs tabular-nums ${!inMonth ? "opacity-30" : day.getDay() === 0 ? "text-brand" : ""}`}>{day.getDate()}</span>
                            {list.map((i) => (
                              <button key={i.show.id + i.session.id} onClick={() => open(i)} aria-label={`${fmtDate(day)} ${i.session.time} ${i.show.title} ${i.hit.join(", ")}`}
                                className="block w-full min-w-0 rounded-md border border-l-4 border-line bg-bg px-1.5 py-1 text-left leading-tight hover:border-brand" style={{ borderLeftColor: showColor(i.show) }}>
                                <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums opacity-80">
                                  {i.session.time}{i.session.curtain && <Star size={9} aria-hidden />}{i.session.timesale && <Percent size={9} aria-hidden />}
                                </span>
                                <span className="block truncate text-[11px] font-bold text-brand">{i.hit.join(" · ")}</span>
                                <span className="block truncate text-[10px] text-mute">{i.show.title}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-mute md:hidden">좌우로 밀면 전체 요일을 볼 수 있어요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {byDate.size === 0 && <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-mute">이 달에는 출연 회차가 없어요.</p>}
                {[...byDate.keys()].sort().map((k) => (
                  <section key={k}>
                    <h3 className="mb-2 text-sm font-bold">{fmtDate(fromKey(k))}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {byDate.get(k)!.map((i) => (
                        <button key={i.show.id + i.session.id} onClick={() => open(i)}
                          className="rounded-xl border border-l-4 border-line bg-card p-3 text-left hover:border-brand" style={{ borderLeftColor: showColor(i.show) }}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold tabular-nums">{i.session.time}</span>
                            {i.session.curtain && <CurtainTag />}{i.session.timesale && <TimeSaleTag />}
                          </div>
                          <div className="mt-0.5 text-sm font-medium">{i.show.title}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand"><Heart size={11} fill="currentColor" aria-hidden />{i.hit.join(" · ")}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        ))}
      </main>

      {sheet && sheetIdx && (
        <SessionSheet idx={sheetIdx} date={sheet.date} focusId={sheet.sid} sel={sheetSel} only={false} toggle={() => {}} favMode onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
