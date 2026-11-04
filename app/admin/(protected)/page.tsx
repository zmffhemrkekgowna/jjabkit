import AdminPanel from "@/components/admin/AdminPanel";
import { TAB_IDS } from "@/lib/adminTabs";
import { fetchEventsSafe } from "@/lib/db/events";
import { fetchPopupsSafe } from "@/lib/db/popups";
import { fetchNoticesSafe } from "@/lib/db/notices";
import { fetchSitePagesSafe } from "@/lib/db/pages";
import { fetchShows } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const db = await createClient();
  const [shows, notices, events, popups, pages] = await Promise.all([fetchShows(db), fetchNoticesSafe(db), fetchEventsSafe(db), fetchPopupsSafe(db), fetchSitePagesSafe(db)]);
  return <AdminPanel shows={shows} notices={notices} events={events} popups={popups} pages={pages.builtin} customPages={pages.custom} initialTab={TAB_IDS.find((t) => t === tab) ?? "shows"} />;
}
