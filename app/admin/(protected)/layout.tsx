import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "공연 관리 · JJabKit", robots: { index: false, follow: false } }; // 검색에 나오지 않게

/**
 * 관리자 화면의 두 번째 잠금장치 (첫 번째는 middleware.ts).
 * 로그인하지 않았으면 로그인 화면으로, 로그인했지만 관리자가 아니면 첫 화면으로 보내요.
 * 진짜 보안 경계는 DB의 RLS이므로, 이 잠금을 우회해도 데이터는 바뀌지 않아요.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { signedIn, isAdmin } = await getAuthState();
  if (!signedIn) redirect("/admin/login");
  if (!isAdmin) redirect("/");
  return <>{children}</>;
}
