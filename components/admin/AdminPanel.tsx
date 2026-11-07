"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Show } from "@/types/show";
import type { Notice } from "@/types/notice";
import type { EventItem } from "@/types/event";
import type { Popup } from "@/types/popup";
import { createClient } from "@/lib/supabase/client";
import { ghost } from "./shared";
import { confirmDiscard, useBeforeUnloadGuard, useDirtyLabels } from "./dirty";
import ShowsAdmin from "./ShowsAdmin";
import PopupsAdmin from "./PopupsAdmin";
import NoticesAdmin, { type NoticeDraft } from "./NoticesAdmin";
import BackupPanel from "./BackupPanel";
import StatsAdmin from "./StatsAdmin";
import PagesAdmin from "./PagesAdmin";
import ToastHost from "./ToastHost";
import type { CustomPage, PageSlug, SitePage } from "@/types/page";
import type { Tab } from "@/lib/adminTabs";

export type { Tab };
const TABS: [Tab, string][] = [["shows", "공연 관리"], ["popups", "팝업 광고"], ["notices", "소식·공지"], ["pages", "안내 페이지"], ["backup", "백업·복구"], ["stats", "방문자 통계"]];

export default function AdminPanel({ shows, notices, events, popups, pages, customPages = [], initialTab = "shows" }: { shows: Show[]; notices: Notice[]; events: EventItem[]; popups: Popup[]; pages: Record<PageSlug, SitePage & { custom: boolean }>; customPages?: CustomPage[]; initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [draft, setDraft] = useState<NoticeDraft | null>(null);

  useBeforeUnloadGuard();
  const dirtyLabels = useDirtyLabels();
  const goTab = (t: Tab) => { if (t === tab || confirmDiscard()) setTab(t); };
  const logout = async () => {
    if (!confirmDiscard()) return; await createClient().auth.signOut(); router.replace("/admin/login"); router.refresh(); };
  const writeNotice = (s: Show) => {
    if (!confirmDiscard()) return;
    setDraft({ nonce: Date.now(), kind: "new_show", showId: s.id, title: `${s.title} 신규 공연 소식` });
    setTab("notices");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-12 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-bold">관리자</h1>
        <button onClick={logout} className={ghost}><LogOut size={14} aria-hidden />로그아웃</button>
      </div>
      <nav role="tablist" aria-label="관리 메뉴" className="flex overflow-x-auto border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => goTab(id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${tab === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
            {label}
          </button>
        ))}
      </nav>
      {dirtyLabels && <p data-testid="dirty-banner" role="note" className="rounded-lg border border-brand bg-hit px-3 py-2 text-xs font-medium text-brand">저장하지 않은 입력이 있어요: {dirtyLabels}. 버튼을 눌러 저장하기 전에는 반영되지 않아요.</p>}
      {tab === "shows" && <ShowsAdmin shows={shows} events={events} onWriteNotice={writeNotice} />}
      {tab === "popups" && <PopupsAdmin popups={popups} />}
      {tab === "notices" && <NoticesAdmin notices={notices} shows={shows} draft={draft} />}
      {tab === "pages" && <PagesAdmin pages={pages} customPages={customPages} />}
      {tab === "backup" && <BackupPanel shows={shows} events={events} />}
      {tab === "stats" && <StatsAdmin />}
      <ToastHost />
    </div>
  );
}
