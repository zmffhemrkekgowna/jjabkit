"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Show } from "@/types/show";
import type { Notice } from "@/types/notice";
import type { EventItem } from "@/types/event";
import type { Popup } from "@/types/popup";
import type { CustomPage, PageSlug, SitePage } from "@/types/page";
import type { Tab } from "@/lib/adminTabs";
import { createClient } from "@/lib/supabase/client";
import { fetchShows } from "@/lib/db/shows";
import { fetchNoticesSafe } from "@/lib/db/notices";
import { fetchEventsSafe } from "@/lib/db/events";
import { fetchPopupsSafe } from "@/lib/db/popups";
import { fetchSitePagesSafe } from "@/lib/db/pages";
import { LoadingScreen } from "@/components/ui/Loading";
import AdminPanel from "./AdminPanel";
import { AdminReloadContext } from "./reload";

/**
 * 관리자 화면 데이터는 브라우저가 Supabase에서 직접 불러와요(Vercel 서버 CPU를 쓰지 않아요).
 * 예전엔 저장할 때마다 서버가 전체 공연·회차·캐스트를 다시 읽고 관리자 화면 전체를 새로 만들었는데(router.refresh),
 * 회차를 많이 입력할수록 Vercel 사용량이 크게 늘었어요. 이제 저장 후에는 브라우저가 데이터만 다시 읽어요.
 * 읽기 권한은 예전과 같아요(관리자 로그인 세션 + DB의 RLS).
 */
interface AdminDataState {
  shows: Show[]; notices: Notice[]; events: EventItem[]; popups: Popup[];
  pages: Record<PageSlug, SitePage & { custom: boolean }>; customPages: CustomPage[];
}


async function load(): Promise<AdminDataState> {
  const db = createClient();
  const [shows, notices, events, popups, pages] = await Promise.all([fetchShows(db), fetchNoticesSafe(db), fetchEventsSafe(db), fetchPopupsSafe(db), fetchSitePagesSafe(db)]);
  return { shows, notices, events, popups, pages: pages.builtin, customPages: pages.custom };
}

export default function AdminData({ initialTab }: { initialTab: Tab }) {
  const [data, setData] = useState<AdminDataState | null>(null);
  const [error, setError] = useState("");
  const seq = useRef(0); // 여러 번 연달아 다시 읽을 때 가장 마지막 결과만 써요

  const reload = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = await load();
      if (my === seq.current) { setData(d); setError(""); }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  if (!data) {
    if (error) return (
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-10 text-center">
        <p className="text-sm text-mute">관리자 데이터를 불러오지 못했어요. ({error.slice(0, 120)})</p>
        <button onClick={() => { setError(""); void reload(); }} className="inline-flex min-h-[44px] items-center rounded-lg border border-brand px-4 text-sm font-bold text-brand">다시 시도</button>
      </main>
    );
    return <main aria-busy="true" className="mx-auto max-w-3xl px-4"><LoadingScreen slowHint /></main>;
  }
  return (
    <AdminReloadContext.Provider value={reload}>
      <AdminPanel {...data} initialTab={initialTab} />
    </AdminReloadContext.Provider>
  );
}
