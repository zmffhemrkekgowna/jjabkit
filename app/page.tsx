import ShowList from "@/components/ShowList";
import { fetchShows } from "@/lib/db/shows";
import { readPublic } from "@/lib/supabase/public";

// 캐시해 두고 재사용해요. 관리자가 저장하면 바로 새로 만들어요(/api/revalidate). lib/cachePolicy.ts 참고
export const revalidate = 300;

export default async function HomePage() {
  return <ShowList shows={await readPublic(fetchShows, [])} />;
}
