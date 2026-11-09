import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchSitePagesSafe } from "@/lib/db/pages";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // 관리자가 추가·수정·삭제한 내용이 바로 보이도록 캐시하지 않아요
export const metadata: Metadata = { title: "이용 안내 - JJabKit", description: "JJabKit(짭킷) 이용 안내와 소개, 개인정보처리방침, 문의" };

/** 본문에서 목록에 보여줄 한 줄 미리보기. 소제목·목록 기호는 빼요. */
function previewOf(body: string): string {
  const line = body.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("## "));
  return (line ?? "").replace(/^[-*] /, "").slice(0, 80);
}

/** 사용자 화면의 '이용 안내' 목록. 관리자 화면의 안내 페이지와 같은 데이터(site_pages)를 읽어요. 읽기만 가능해요. */
export default async function GuidePage() {
  const db = await createClient().catch(() => null);
  const { builtin, custom } = await fetchSitePagesSafe(db);
  const items = [
    { href: "/guide/popup-ads", title: "팝업 광고 문의", body: "짭킷 홈 화면 팝업 광고의 이미지 규격과 노출 방식, 게재 문의 방법을 안내해요.", ad: true },
    ...custom.map((p) => ({ href: `/guide/${p.slug}`, title: p.title, body: p.body })),
    ...(["about", "privacy", "contact"] as const).map((s) => ({ href: `/${s}`, title: builtin[s].title, body: builtin[s].body })),
  ];
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <h1 className="font-serif text-2xl font-bold">이용 안내</h1>
      <p className="mt-1 text-sm text-mute">서비스 이용에 도움이 되는 안내를 모아 두었어요.</p>
      <ul aria-label="안내 페이지 목록" className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="flex items-center gap-3 px-4 py-3 hover:bg-hit">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{it.title}</span>
                  {"ad" in it && <span className="shrink-0 rounded-full border border-brand px-1.5 py-0.5 text-[11px] font-medium text-brand">광고주 안내</span>}
                </span>
                {previewOf(it.body) && <span className="mt-0.5 block truncate text-xs text-mute">{previewOf(it.body)}</span>}
              </span>
              <ChevronRight size={16} aria-hidden className="shrink-0 text-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
