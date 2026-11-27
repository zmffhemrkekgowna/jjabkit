import AdminData from "@/components/admin/AdminData";
import { TAB_IDS } from "@/lib/adminTabs";

export const dynamic = "force-dynamic";

/**
 * 관리자 화면. 로그인·관리자 확인은 layout(서버)이 하고, 데이터는 브라우저가 직접 불러와요(AdminData).
 * 서버는 데이터를 읽지 않아서 Vercel CPU를 거의 쓰지 않아요.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <AdminData initialTab={TAB_IDS.find((t) => t === tab) ?? "shows"} />;
}
