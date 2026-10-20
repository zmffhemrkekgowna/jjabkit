"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Show } from "@/types/show";
import type { Notice } from "@/types/notice";
import { createClient } from "@/lib/supabase/client";
import { ghost } from "./shared";
import ShowsAdmin from "./ShowsAdmin";
import NoticesAdmin, { type NoticeDraft } from "./NoticesAdmin";
import BackupPanel from "./BackupPanel";

export type Tab = "shows" | "notices" | "backup";
const TABS: [Tab, string][] = [["shows", "공연 관리"], ["notices", "소식·공지"], ["backup", "백업·복구"]];

export default function AdminPanel({ shows, notices, initialTab = "shows" }: { shows: Show[]; notices: Notice[]; initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [draft, setDraft] = useState<NoticeDraft | null>(null);

  const logout = async () => { await createClient().auth.signOut(); router.replace("/admin/login"); router.refresh(); };
  const writeNotice = (s: Show) => {
    setDraft({ nonce: Date.now(), kind: "schedule", showId: s.id, title: `${s.title} 캐스팅·일정 안내` });
    setTab("notices");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-12 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-bold">관리자</h1>
        <button onClick={logout} className={ghost}><LogOut size={14} aria-hidden />로그아웃</button>
      </div>
      <nav role="tablist" aria-label="관리 메뉴" className="flex border-b border-line">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "shows" && <ShowsAdmin shows={shows} onWriteNotice={writeNotice} />}
      {tab === "notices" && <NoticesAdmin notices={notices} shows={shows} draft={draft} />}
      {tab === "backup" && <BackupPanel shows={shows} />}
    </div>
  );
}
