import FavBackup from "@/components/my/FavBackup";
import { getAuthState } from "@/lib/auth";
import { fetchShows } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "데이터 백업 · 뮤킷" };

export default async function BackupRoute() {
  const [{ isAdmin }, shows] = await Promise.all([getAuthState(), fetchShows(await createClient())]);
  return <FavBackup shows={shows.map((s) => ({ id: s.id, title: s.title }))} isAdmin={isAdmin} />;
}
