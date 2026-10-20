"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Clapperboard, DatabaseBackup, House, UserRound } from "lucide-react";

type MyTab = "show" | "actor" | "sched";
export const myTabOf = (v: string | null | undefined): MyTab => (v === "show" || v === "actor" ? v : "sched");

const ITEMS = [
  { id: "home", label: "홈", href: "/", Icon: House },
  { id: "show", label: "관심공연", href: "/my?tab=show", Icon: Clapperboard },
  { id: "actor", label: "관심배우", href: "/my?tab=actor", Icon: UserRound },
  { id: "sched", label: "내일정", href: "/my?tab=sched", Icon: CalendarDays },
  { id: "backup", label: "데이터 백업", href: "/backup", Icon: DatabaseBackup },
] as const;

function Nav() {
  const path = usePathname() ?? "";
  const tab = myTabOf(useSearchParams().get("tab"));
  if (path.startsWith("/admin")) return null; // 관리자 화면은 자체 탭이 있어요
  const active = path === "/" || path.startsWith("/shows") ? "home" : path.startsWith("/my") ? tab : path.startsWith("/backup") ? "backup" : "";
  return (
    <nav aria-label="하단 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {ITEMS.map(({ id, label, href, Icon }) => {
          const on = active === id;
          return (
            <li key={id}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-bold text-brand" : "text-mute"}`}>
                <Icon size={20} aria-hidden strokeWidth={on ? 2.4 : 1.8} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 화면 맨 아래 고정 메뉴. 홈 / 관심공연 / 관심배우 / 내일정 / 데이터 백업. */
export default function BottomNav() {
  return <Suspense fallback={null}><Nav /></Suspense>;
}
