"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFavorites } from "@/lib/favorites";
import ThemeToggle from "./ThemeToggle";
import NoticeBell from "./NoticeBell";
import type { Notice } from "@/types/notice";

/**
 * 맨 위 고정 막대. 관리자 화면 링크는 관리자로 로그인했을 때만 보여요.
 * (링크를 숨기는 건 화면 편의일 뿐이고, 접근 차단은 서버(middleware)와 DB(RLS)가 해요.)
 */
export default function ModeBar({ isAdmin, notices }: { isAdmin: boolean; notices: Notice[] }) {
  const path = usePathname();
  const fav = useFavorites();
  const count = fav.shows.size + fav.actors.size;
  const here = path.startsWith("/admin") ? "admin" : path.startsWith("/my") ? "my" : "user";
  const tab = (on: boolean) => `rounded-md px-2.5 py-1 text-[13px] ${on ? "bg-ink text-bg" : "text-mute"}`;
  return (
    <div className="sticky top-0 z-40 flex h-11 items-center justify-between border-b border-line bg-card px-4">
      <nav className="inline-flex rounded-lg border border-line p-0.5" aria-label="화면 전환">
        <Link href="/" aria-current={here === "user" ? "page" : undefined} className={tab(here === "user")}>사용자 화면</Link>
        <Link href="/my" aria-current={here === "my" ? "page" : undefined} className={tab(here === "my")}>
          마이페이지
          {count > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 text-[11px] font-bold text-onbrand">{count}</span>}
        </Link>
        {isAdmin && <Link href="/admin" aria-current={here === "admin" ? "page" : undefined} className={tab(here === "admin")}>관리자 화면</Link>}
      </nav>
      <div className="flex shrink-0 items-center gap-1.5">
        <NoticeBell notices={notices} />
        <ThemeToggle />
      </div>
    </div>
  );
}
