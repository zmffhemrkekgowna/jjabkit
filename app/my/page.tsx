import MyPage from "@/components/my/MyPage";
import { fetchShows } from "@/lib/db/shows";
import { readPublic } from "@/lib/supabase/public";

export const revalidate = 86400; // 캐시(관리자 저장 시 즉시 갱신). lib/cachePolicy.ts 참고

/** 하트 정보는 브라우저에 저장되므로, 서버는 공연 데이터만 넘기고 화면이 하트와 맞춰 보여줘요. */
export default async function MyRoute() {
  const shows = await readPublic(fetchShows, []);
  return <MyPage shows={shows} />;
}
