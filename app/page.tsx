import ShowList from "@/components/ShowList";
import { fetchShows } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // 관리자에서 고친 내용이 바로 보이도록 캐시하지 않아요

export default async function HomePage() {
  const shows = await fetchShows(await createClient());
  return <ShowList shows={shows} />;
}
