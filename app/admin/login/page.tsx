import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 로그인 · JJabKit", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const { isAdmin } = await getAuthState();
  if (isAdmin) redirect("/admin");
  return <LoginForm />;
}
