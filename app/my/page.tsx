import MyPage from "@/components/my/MyPage";
import { fetchShows } from "@/lib/db/shows";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 하트 정보는 브라우저에 저장되므로, 서버는 공연 데이터만 넘기고 화면이 하트와 맞춰 보여줘요. */
export default async function MyRoute() {
  const shows = await fetchShows(await createClient());
  return <MyPage shows={shows} />;
}
