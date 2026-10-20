import AdminPanel from "@/components/admin/AdminPanel";
import { fetchNoticesSafe } from "@/lib/db/notices";
import { fetchShows } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const db = await createClient();
  const [shows, notices] = await Promise.all([fetchShows(db), fetchNoticesSafe(db)]);
  return <AdminPanel shows={shows} notices={notices} initialTab={tab === "backup" || tab === "notices" ? tab : "shows"} />;
}
