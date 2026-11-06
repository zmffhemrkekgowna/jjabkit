"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NoticeBell from "./NoticeBell";
import type { Notice } from "@/types/notice";

/**
 * 맨 위 고정 막대. 관리자 화면 링크는 관리자로 로그인했을 때만 보여요.
 * (링크를 숨기는 건 화면 편의일 뿐이고, 접근 차단은 서버(middleware)와 DB(RLS)가 해요.)
 */
export default function ModeBar({ isAdmin, notices }: { isAdmin: boolean; notices: Notice[] }) {
  const path = usePathname();
  const here = path.startsWith("/admin") ? "admin" : path.startsWith("/my") ? "my" : "user";
  const tab = (on: boolean) => `whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium min-[400px]:px-2.5 ${on ? "bg-brand text-onbrand" : "text-mute hover:text-brand"}`;
  /** 360px처럼 좁은 화면에서는 짧은 이름으로 보여요(이동 주소와 기능은 그대로, 읽어 주는 이름은 전체 이름). */
  const label = (short: string, full: string) => (<><span aria-hidden className="min-[400px]:hidden">{short}</span><span aria-hidden className="hidden min-[400px]:inline">{full}</span></>);
  return (
    <div className="sticky top-0 z-40 flex h-11 items-center justify-between border-b border-line bg-card px-3 sm:px-4">
      <nav className="inline-flex rounded-lg border border-line p-0.5" aria-label="화면 전환">
        <Link href="/" aria-current={here === "user" ? "page" : undefined} aria-label="사용자 화면" className={tab(here === "user")}>{label("사용자", "사용자 화면")}</Link>
        <Link href="/my" aria-current={here === "my" ? "page" : undefined} aria-label="마이페이지" className={tab(here === "my")}>{label("마이", "마이페이지")}</Link>
        {isAdmin && <Link href="/admin" aria-current={here === "admin" ? "page" : undefined} aria-label="관리자 화면" className={tab(here === "admin")}>{label("관리자", "관리자 화면")}</Link>}
      </nav>
      <div className="flex shrink-0 items-center gap-1">
        <Link href="/guide" aria-label="이용 안내" title="이용 안내" aria-current={path.startsWith("/guide") ? "page" : undefined}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${path.startsWith("/guide") ? "border-brand text-brand" : "border-line text-mute hover:text-brand"}`}>
          <BookOpen size={16} aria-hidden />
        </Link>
        <NoticeBell notices={notices} />
        <ThemeToggle />
      </div>
    </div>
  );
}
