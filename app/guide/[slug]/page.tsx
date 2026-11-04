import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InfoView } from "@/components/InfoPage";
import { fetchCustomPageSafe } from "@/lib/db/pages";
import { createClient } from "@/lib/supabase/server";
import { SLUG_RE, isBuiltinSlug } from "@/types/page";

export const dynamic = "force-dynamic"; // 수정·삭제가 바로 반영되도록 캐시하지 않아요

async function load(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const db = await createClient().catch(() => null);
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
