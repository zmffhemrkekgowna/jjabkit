"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, DatabaseBackup, House, UserRound } from "lucide-react";

export type MyTab = "show" | "actor" | "fsched" | "sched";
/** 마이페이지 탭: 관심 공연 / 관심 배우 / 관심 배우 일정(fsched) / 내 일정(sched, 기본) */
export const myTabOf = (v: string | null | undefined): MyTab => (v === "show" || v === "actor" || v === "fsched" ? v : "sched");

const ITEMS = [
  { id: "home", label: "홈", href: "/", Icon: House },
  { id: "today", label: "오늘공연", href: "/today", Icon: CalendarClock },
  { id: "my", label: "마이페이지", href: "/my", Icon: UserRound },
  { id: "backup", label: "데이터 백업", href: "/backup", Icon: DatabaseBackup },
] as const;

function Nav() {
  const path = usePathname() ?? "";
  if (path.startsWith("/admin")) return null; // 관리자 화면은 자체 탭이 있어요
  const active = path === "/" || path.startsWith("/shows") ? "home" : path.startsWith("/my") ? "my" : path.startsWith("/backup") ? "backup" : path.startsWith("/today") ? "today" : "";
  return (
    <nav aria-label="하단 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
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

/** 화면 맨 아래 고정 메뉴. 홈 / 오늘공연 / 마이페이지 / 데이터 백업. 관심 공연·관심 배우·관심 배우 일정·내 일정은 마이페이지 안 탭이에요. */
export default function BottomNav() {
  return <Nav />;
}
