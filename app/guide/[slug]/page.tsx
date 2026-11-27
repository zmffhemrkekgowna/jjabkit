import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InfoView } from "@/components/InfoPage";
import { fetchCustomPageSafe } from "@/lib/db/pages";
import { createPublicClient } from "@/lib/supabase/public";
import { SLUG_RE, isBuiltinSlug } from "@/types/page";

export const revalidate = 86400; // 캐시해 두고, 수정·삭제하면 바로 새로 만들어요(/api/revalidate)

/** 미리 만들어 두는 주소는 없고, 처음 열릴 때 만들어 캐시해요(이게 있어야 주소별 캐시가 켜져요). */
export function generateStaticParams() { return []; }

async function load(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const db = createPublicClient();
  return fetchCustomPageSafe(db, slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug).catch(() => null);
  return page ? { title: `${page.title} - JJabKit` } : {};
}

/** 관리자가 추가한 안내 페이지. 삭제됐거나 주소가 틀리면 '찾을 수 없어요'가 나와요. */
export default async function GuideDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isBuiltinSlug(slug)) redirect(`/${slug}`); // 소개·개인정보처리방침·문의는 원래 주소를 써요
  const page = await load(slug);
  if (!page) notFound();
  return <InfoView title={page.title} body={page.body} updatedAt={page.updatedAt} back={{ href: "/guide", label: "이용 안내" }} />;
}
