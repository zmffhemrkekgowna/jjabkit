"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { myTabOf, type MyTab } from "../BottomNav";
import { CalendarPlus, ChevronLeft, ChevronRight, Heart, Search, Star, X } from "lucide-react";
import type { Show } from "@/types/show";
import { DOW, addDays, buildIndex, fmtDate, fromKey, toKey } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { useMySched } from "@/lib/mySched";
import { todayKST } from "@/lib/period";
import { useNowKST, useTodayKST } from "@/lib/useToday";
import { appearancesOf, buildMySchedule, showColor, type MyItem } from "@/lib/mySchedule";
import { readableText } from "@/lib/color";
import Avatar from "../ui/Avatar";
import { HeartButton } from "../ui/HeartButton";
import { CurtainTag } from "../ui/Tags";
import ShowCard from "../ShowCard";
import SessionSheet from "../casting/SessionSheet";
import StatsPanel from "./StatsPanel";
import UserDataSync from "../UserDataSync";
import MySchedCalendar from "./MySchedCalendar";
import ShareBar from "../ShareBar";
import { mySchedSpec } from "@/lib/calendarImage";
import { buildIcs, castNames, icsActorsFileName, icsFileName } from "@/lib/ics";
import { ddayText, nextMine } from "@/lib/home";
import { downloadBlob } from "@/lib/download";

type Tab = MyTab;
const TAB_HELP: Record<Tab, string> = {
  show: "하트로 담아 둔 공연 모음이에요.",
  actor: "하트로 담아 둔 배우와 그 배우가 나오는 공연이에요.",
  fsched: "관심 배우가 출연하는 모든 회차예요. 내가 보러 가기로 한 날과는 별개예요.",
  stats: "내 일정에서 ‘관극 완료’로 직접 표시한 회차만 센 통계예요. 관심 배우의 출연 일정이나 앞으로의 일정은 들어가지 않아요.",
  sched: "내가 직접 ‘내 일정 추가’로 담은 관람 일정이에요.",
};
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-8 text-center">
      <p className="text-sm text-mute">{text}</p>
      <Link href="/" className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-line px-4 text-sm font-medium">공연 보러 가기</Link>
    </div>
  );
}

export default function MyPage({ shows }: { shows: Show[] }) {
  const fav = useFavorites();
  // 공연 id가 바뀌어도(전체 교체 복원) 하트·내 일정이 끊기지 않게 UserDataSync가 제목·날짜·시간으로 이어 붙여요.
  const mySched = useMySched();
  const myItems = useMemo(() => {
    const out: { show: Show; session: Show["sessions"][number] }[] = [];
    for (const show of shows) for (const session of show.sessions) if (mySched.ids.has(session.id)) out.push({ show, session });
    const k = (i: { show: Show; session: { date: string; time: string } }) => i.session.date + i.session.time + i.show.title;
    return out.sort((a, b) => k(a).localeCompare(k(b)));
  }, [shows, mySched.ids]);
  const today = useTodayKST();
  // '앞으로'인지는 날짜뿐 아니라 시작 시간까지 한국 시간으로 비교해요. 오늘 회차라도 이미 시작했으면 지난 일정이에요.
  const now = useNowKST();
  const isUpcoming = (i: { session: { date: string; time: string } }) => `${i.session.date} ${i.session.time}` >= now;
  const upcoming = myItems.filter(isUpcoming);
  // 탭은 주소(?tab=)가 기준이에요. 하단 메뉴와 같은 값을 쓰고, 화면 안에서 탭을 눌러도 주소만 바꿔서 서버를 다시 부르지 않아요.
  const tab: Tab = myTabOf(useSearchParams().get("tab"));
  const setTab = (t: Tab) => window.history.replaceState(null, "", `?tab=${t}`);
  // 탭이 많아 좁은 화면에서 가로로 밀릴 때, 선택된 탭이 항상 보이게 해요.
  useEffect(() => { document.querySelector<HTMLElement>("[role=tab][aria-selected=true]")?.scrollIntoView({ inline: "nearest", block: "nearest" }); }, [tab]);
  const [view, setView] = useState<"month" | "list">("month");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [aq, setAq] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [together, setTogether] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => firstOfMonth(fromKey(todayKST())));
  const [sheet, setSheet] = useState<{ showId: string; date: string; sid: string } | null>(null);

  const names = useMemo(() => [...fav.actors], [fav.actors]);
  const favShows = shows.filter((s) => fav.shows.has(s.id));
  const shown = useMemo(() => new Set(names.filter((n) => !hidden.has(n))), [names, hidden]);
  const baseItems = useMemo(() => buildMySchedule(shows, shown), [shows, shown]);
  // 여러 명이 같은 회차에 함께 서는 날만 골라 볼 수 있어요. (선택한 배우가 2명 이상일 때)
  const items = useMemo(() => (together ? baseItems.filter((i) => i.hit.length >= 2) : baseItems), [baseItems, together]);
  const nextActor = useMemo(() => items.find((i) => `${i.session.date} ${i.session.time}` >= now) ?? null, [items, now]);
  const actorUpcoming = useMemo(() => items.filter((i) => `${i.session.date} ${i.session.time}` >= now).map(({ show, session, hit }) => ({ show, session, hit })), [items, now]);
  const nextOwn = useMemo(() => nextMine(shows, mySched.ids), [shows, mySched.ids, now]); // eslint-disable-line react-hooks/exhaustive-deps -- now: 시각이 바뀌면 다시 계산
  const aqk = aq.trim().toLowerCase().replace(/\s+/g, "");
  const chipNames = names.filter((n) => (!aqk || n.toLowerCase().replace(/\s+/g, "").includes(aqk)) && (!onlyPicked || !hidden.has(n)));

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
  const tabs: [Tab, string][] = [["show", `관심 공연 ${favShows.length}`], ["actor", `관심 배우 ${names.length}`], ["fsched", "관심 배우 일정"], ["sched", `내 일정${myItems.length ? ` ${myItems.length}` : ""}`], ["stats", "관극 통계"]];

  return (
    <div className="mx-auto max-w-3xl pb-10 lg:max-w-5xl">
      <UserDataSync shows={shows} />
      <header className="px-4 pb-3 pt-5">
        <h1 className="font-serif text-xl font-bold">마이페이지</h1>
        <p className="mt-1 text-xs text-mute">하트로 등록한 관심 공연·관심 배우와 내가 추가한 일정이 이 브라우저에 저장돼요.</p>
      </header>

      <nav role="tablist" className="sticky top-11 z-30 flex overflow-x-auto border-b border-line bg-bg px-2 sm:px-4">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3 text-[13px] font-bold sm:px-4 sm:text-sm ${tab === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
            {label}
          </button>
        ))}
      </nav>

      <main className="space-y-3 px-4 pt-4">
        <p className="text-xs text-mute">{TAB_HELP[tab]}</p>
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

        {tab === "fsched" && (names.length === 0 ? (
          <Empty text="관심 배우를 등록하면 그 배우가 출연하는 모든 회차를 여기에 모아 보여줘요." />
        ) : (
          <>
            <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p aria-live="polite" className="mr-auto text-sm font-bold">배우 <span className="text-brand">{shown.size}</span> / {names.length}명 선택</p>
                <button onClick={() => setHidden(new Set())} disabled={shown.size === names.length} className="min-h-[44px] rounded-lg border border-line px-3 text-sm disabled:opacity-40">전체 선택</button>
                <button onClick={() => setHidden(new Set(names))} disabled={shown.size === 0} className="min-h-[44px] rounded-lg border border-line px-3 text-sm disabled:opacity-40">전체 해제</button>
              </div>
              {names.length > 6 && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"><Search size={14} aria-hidden /></span>
                  <input type="search" value={aq} onChange={(e) => setAq(e.target.value)} placeholder="관심 배우 이름 검색" aria-label="관심 배우 이름 검색"
                    className="min-h-[44px] w-full rounded-lg border border-line bg-bg py-2 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none" />
                  {aq && <button onClick={() => setAq("")} aria-label="검색어 지우기" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-mute"><X size={14} aria-hidden /></button>}
                </div>
              )}
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto overscroll-contain" role="group" aria-label="일정에 포함할 배우">
                {chipNames.map((n) => (
                  <button key={n} aria-pressed={!hidden.has(n)} onClick={() => toggleHidden(n)}
                    className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3 text-sm ${hidden.has(n) ? "border-line text-mute line-through" : "border-brand bg-brand text-onbrand"}`}>
                    <Heart size={12} fill={hidden.has(n) ? "none" : "currentColor"} aria-hidden />{n}
                  </button>
                ))}
                {chipNames.length === 0 && <p className="text-sm text-mute">{aqk ? `‘${aq.trim()}’ 배우가 없어요.` : "선택한 배우가 없어요. ‘선택만 보기’를 끄고 배우를 골라 보세요."}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />선택한 배우만 보기</label>
                {shown.size >= 2 && <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />함께 출연하는 회차만</label>}
              </div>
            </div>

            {nextActor && (
              <button onClick={() => open(nextActor)} className="block w-full rounded-xl border border-brand bg-hit p-3 text-left">
                <span className="text-xs font-bold text-brand">가장 가까운 출연 · {ddayText(Math.round((fromKey(nextActor.session.date).getTime() - fromKey(today).getTime()) / 86400e3))}</span>
                <span className="mt-0.5 block font-bold">{fmtDate(fromKey(nextActor.session.date))} {nextActor.session.time} · {nextActor.show.title}</span>
                <span className="mt-0.5 block truncate text-xs text-mute">{nextActor.hit.join(" · ")}{nextActor.show.venue ? ` · ${nextActor.show.venue}` : ""}</span>
              </button>
            )}

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

            {actorUpcoming.length > 0 && (
              <div className="rounded-xl border border-line bg-card p-3">
                <button onClick={() => downloadBlob(new Blob([buildIcs(actorUpcoming, new Date(), "JJabKit 관심 배우 일정")], { type: "text/calendar;charset=utf-8" }), icsActorsFileName([...shown]))}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-brand px-3 text-sm font-bold text-brand">
                  <CalendarPlus size={15} aria-hidden />선택한 배우 일정 저장 (.ics)
                </button>
                <p className="mt-1.5 text-xs text-mute">선택한 배우 {shown.size}명의 앞으로 일정 {actorUpcoming.length}개가 들어가요. 화면에서 고른 배우·옵션이 그대로 반영돼요.</p>
              </div>
            )}
            {items.length > 0 && (
              <ShareBar
                build={() => mySchedSpec(items, cur, [...shown])}
                fileBase={`관심배우일정-${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`}
                shareTitle="내 관심 배우 일정" shareText={`내 관심 배우 일정 ${cur.getFullYear()}년 ${cur.getMonth() + 1}월 (${[...shown].join(", ")})`}
              />
            )}

            <p aria-live="polite" className="text-sm text-mute">
              {items.length === 0 ? (shown.size === 0 ? "선택한 배우가 없어요. 위에서 배우를 골라 주세요." : together ? "선택한 배우가 함께 출연하는 회차가 없어요. ‘함께 출연하는 회차만’을 꺼 보세요." : "선택한 관심 배우가 출연하는 회차가 아직 없어요. 공연 상세에서 다른 공연의 배우도 등록해 보세요.") : <>이번 달 출연 <b className="text-brand">{monthItems.length}</b>회차 · 전체 {items.length}회차</>}
            </p>

            {view === "month" ? (
              <div>
                <div role="grid" aria-label="관심 배우 일정 달력" className="overflow-hidden rounded-2xl border border-line bg-card">
                  <div>
                    <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">
                      {DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
                      {days.map((day) => {
                        const k = toKey(day);
                        const inMonth = day.getMonth() === cur.getMonth();
                        const list = inMonth ? byDate.get(k) ?? [] : [];
                        return (
                          <div key={k} role="gridcell" className={`flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 p-0.5 sm:min-h-[6.5rem] sm:gap-1 sm:p-1 ${!inMonth ? "bg-bg" : list.length ? "bg-hit" : "bg-card"}`}>
                            <span className={`px-0.5 text-[11px] tabular-nums sm:text-xs ${!inMonth ? "opacity-30" : day.getDay() === 0 ? "text-brand" : ""}`}>{day.getDate()}</span>
                            {list.map((i) => (
                              <button key={i.show.id + i.session.id} onClick={() => open(i)} aria-label={`${fmtDate(day)} ${i.session.time} ${i.show.title} ${i.hit.join(", ")}`}
                                className="block w-full min-w-0 rounded-md px-1 py-1 text-left leading-tight hover:brightness-110 sm:px-1.5" style={{ background: showColor(i.show), color: readableText(showColor(i.show)) }}>
                                <span className="flex flex-wrap items-center gap-x-0.5 text-[11px] font-bold tabular-nums sm:gap-x-1 sm:text-xs">
                                  {i.session.time}{i.session.curtain && <Star size={9} aria-hidden />}
                                </span>
                                <span className="hidden truncate text-[11px] font-bold sm:block">{i.hit.join(" · ")}</span>
                                {i.hit.map((n) => <span key={n} className="block truncate text-[10px] font-bold sm:hidden">{n}</span>)}
                                <span className="hidden truncate text-[10px] sm:block">{i.show.title}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
                          className="rounded-xl border border-l-4 border-line bg-card p-3 text-left hover:border-brand" style={{ background: showColor(i.show), color: readableText(showColor(i.show)) }}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold tabular-nums">{i.session.time}</span>
                            {i.session.curtain && <CurtainTag />}
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

        {tab === "stats" && <StatsPanel />}

        {tab === "sched" && (myItems.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <p className="font-medium">아직 추가한 일정이 없습니다.</p>
            <p className="mt-1 text-sm text-mute">공연 상세에서 관람할 날짜의 회차를 눌러, 회차 정보 아래의 &lsquo;내 일정 추가&rsquo; 버튼으로 담아 보세요.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link href="/today" className="inline-flex min-h-[44px] items-center rounded-lg border border-brand px-4 text-sm font-bold text-brand">오늘 공연 보기</Link>
              <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg border border-line px-4 text-sm font-medium">공연 목록 보기</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {nextOwn && (
              <button onClick={() => setSheet({ showId: nextOwn.show.id, date: nextOwn.session.date, sid: nextOwn.session.id })}
                className="block w-full rounded-xl border border-brand bg-hit p-3 text-left">
                <span className="text-xs font-bold text-brand">가장 가까운 관람 · {ddayText(nextOwn.days)}{nextOwn.extra > 0 ? ` · 이후 ${nextOwn.extra}개` : ""}</span>
                <span className="mt-0.5 block font-bold">{nextOwn.show.title}</span>
                <span className="block text-sm">{fmtDate(fromKey(nextOwn.session.date))} {nextOwn.session.time}{nextOwn.show.venue ? ` · ${nextOwn.show.venue}` : ""}</span>
                <span className="mt-0.5 block truncate text-xs text-mute">{castNames(nextOwn.show, nextOwn.session).join(" · ") || "출연진 미정"}</span>
              </button>
            )}
            {upcoming.length > 0 && (
              <div className="rounded-xl border border-line bg-card p-3">
                <button onClick={() => downloadBlob(new Blob([buildIcs(upcoming)], { type: "text/calendar;charset=utf-8" }), icsFileName())}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-brand px-3 py-2 text-sm font-bold text-brand">
                  <CalendarPlus size={15} aria-hidden />캘린더에 저장 (.ics)
                </button>
                <p className="mt-1.5 text-xs text-mute">다가오는 일정 {upcoming.length}개를 내려받아 열면 폰 캘린더에 들어가요. 하루 전·2시간 전 알림이 함께 들어가요.</p>
              </div>
            )}
            <MySchedCalendar items={myItems} now={now} today={today} onRemove={mySched.remove}
              onOpenSession={(i) => setSheet({ showId: i.show.id, date: i.session.date, sid: i.session.id })} />
          </div>
        ))}
      </main>

      {sheet && sheetIdx && (
        <SessionSheet idx={sheetIdx} date={sheet.date} focusId={sheet.sid} sel={sheetSel} only={false} toggle={() => {}} favMode onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
