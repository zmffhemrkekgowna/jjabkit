import FavBackup from "@/components/my/FavBackup";
import { fetchShows } from "@/lib/db/shows";
import { readPublic } from "@/lib/supabase/public";

export const revalidate = 86400; // 캐시(관리자 저장 시 즉시 갱신). 관리자 여부는 화면(브라우저)에서 확인해요
export const metadata = { title: "데이터 백업 · JJabKit" };

export default async function BackupRoute() {
  const shows = await readPublic(fetchShows, []);
  return <FavBackup shows={shows.map((s) => ({ id: s.id, title: s.title, sessions: s.sessions.map((x) => ({ id: x.id, date: x.date, time: x.time })) }))} />;
}
