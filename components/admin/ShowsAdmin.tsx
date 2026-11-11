"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, ChevronRight, ClipboardPaste, Eye, Plus, Search, Trash2 } from "lucide-react";
import type { Show } from "@/types/show";
import { statusOf } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import { StatusTag } from "../ui/Tags";
import type { EventItem } from "@/types/event";
import { createShow, deleteShowBundle, restoreNote, restoreShowBundle, type ShowBundle } from "@/lib/db/shows";
import { confirmDiscard } from "./dirty";
import { withShowColor } from "@/lib/color";
import { btn, ghost, inp, useAdminRun } from "./shared";
import ShowForm from "./ShowForm";
import RolesEditor from "./RolesEditor";
import SessionsEditor from "./SessionsEditor";
import ShowEventsEditor from "./ShowEventsEditor";

type EvFilter = "all" | "with" | "without";
const FILTERS: [EvFilter, string][] = [["all", "전체"], ["with", "이벤트 있음"], ["without", "이벤트 없음"]];

export default function ShowsAdmin({ shows, events, onWriteNotice, onOpenImport }: { shows: Show[]; events: EventItem[]; onWriteNotice: (show: Show) => void; onOpenImport?: () => void }) {
  // aid가 없으면 공연 목록, 있으면 그 공연의 상세 관리 화면이에요.
  const today = useTodayKST();
  const [aid, setAid] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EvFilter>("all");
  const { run, msg, setMsg } = useAdminRun();
  const show = aid ? shows.find((s) => s.id === aid) : undefined; // 삭제 등으로 사라지면 자동으로 목록으로 돌아가요
  const evOf = (id: string) => events.filter((e) => e.showId === id);
  const go = (id: string | null) => { setAid(id); setMsg(""); setAsk(false); if (typeof window !== "undefined") window.scrollTo(0, 0); };
  const pick = (id: string | null) => { if (confirmDiscard()) go(id); };
  const leave = () => go(null); // 공연을 지운 뒤에는 묻지 않고 목록으로

  const addShow = () => run(async (c) => { pick(await createShow(c)); }, "새 공연을 만들었어요. 아래에서 정보를 채워 주세요.");

  if (!show) {
    // 검색어와 이벤트 유무 필터는 함께 적용돼요. 이벤트 정보는 목록에 표시하지 않고 필터로만 써요.
    const needle = q.trim().toLowerCase();
    const shown = shows.filter((x) =>
      (!needle || (x.title || "(제목 없음)").toLowerCase().includes(needle)) &&
      (filter === "all" || (filter === "with") === (evOf(x.id).length > 0)));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">공연 관리</h2>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenImport && <button onClick={onOpenImport} className={ghost} data-testid="open-import"><ClipboardPaste size={14} aria-hidden />엑셀 붙여넣기</button>}
            <button onClick={addShow} className={btn}><Plus size={14} aria-hidden />새 공연</button>
          </div>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>
        {shows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-mute">등록된 공연이 없어요. &lsquo;새 공연&rsquo;으로 첫 공연을 만들어 보세요.</p>
        ) : (
          <>
            <div className="relative">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="공연명을 검색하세요." aria-label="공연명 검색" className={`${inp} pr-10`} />
              <Search size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="이벤트 유무 필터">
                {FILTERS.map(([v, label]) => (
                  <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}
                    className={`rounded-md px-3 py-1.5 text-sm ${filter === v ? "bg-ink text-bg" : "text-mute"}`}>{label}</button>
                ))}
              </div>
              <span className="text-xs text-mute">{shown.length === shows.length ? `공연 ${shows.length}개` : `${shown.length} / ${shows.length}개`}</span>
            </div>
            {shown.length === 0 ? (
              <p role="status" className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-mute">검색 결과가 없습니다.</p>
            ) : (
              <ul aria-label="공연 목록" className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                {shown.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => pick(x.id)} aria-label={`${x.title || "(제목 없음)"} 관리`} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-hit">
                      <span className="min-w-0 flex-1 truncate font-medium">{x.title || "(제목 없음)"}</span>
                      <StatusTag status={statusOf(x, today)} className="shrink-0" />
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-mute" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => pick(null)} className={ghost}><ArrowLeft size={14} aria-hidden />공연 목록</button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{show.title || "(제목 없음)"}</h2>
      </div>
      <p className="text-xs text-mute">여기서 고친 내용은 DB에 저장되고, 사용자 화면(목록·달력)에 바로 반영돼요. 관리자 계정만 저장할 수 있어요.</p>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/shows/${show.id}`} className={btn}><Eye size={14} aria-hidden />사용자 화면에서 보기</Link>
        <button onClick={() => onWriteNotice(show)} className={ghost}><Bell size={14} aria-hidden />이 공연 소식 쓰기</button>
        {ask ? (
          <>
            <span className="text-sm">이 공연과 회차를 모두 삭제할까요?</span>
            <button onClick={() => {
              let bundle: ShowBundle | null = null; // DB가 지우기 직전 내용을 돌려줘요(배역·배우·회차·캐스팅·이벤트 포함)
              return run(async (c) => { bundle = await deleteShowBundle(c, show.id); }, "공연을 삭제했어요.",
                () => run(async (c) => (bundle ? restoreShowBundle(c, bundle) : null), (r) => `삭제한 공연을 되살렸어요. ${restoreNote(r)}`.trim())).then(() => leave());
            }} className={btn}>확인</button>
            <button onClick={() => setAsk(false)} className={ghost}>취소</button>
          </>
        ) : (
          <button onClick={() => setAsk(true)} className={ghost}><Trash2 size={14} aria-hidden />공연 삭제</button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      {/* key를 공연 id로 두어 공연을 바꾸면 입력 상태가 초기화돼요 */}
      <ShowForm key={`f-${show.id}`} show={show} run={run} />
      <ShowEventsEditor key={`e-${show.id}`} show={show} events={evOf(show.id)} run={run} />
      <RolesEditor key={`r-${show.id}`} show={show} run={run} />
      <SessionsEditor key={`s-${show.id}`} show={show} events={withShowColor(evOf(show.id), show)} run={run} notify={setMsg} />
    </div>
  );
}
