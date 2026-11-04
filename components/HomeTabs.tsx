import Link from "next/link";

/** 메인 위쪽 탭: 공연 목록 / 오늘 공연. 두 화면이 같이 써요. */
export default function HomeTabs({ active }: { active: "list" | "today" }) {
  const items = [["list", "공연 목록", "/"], ["today", "오늘 공연", "/today"]] as const;
  return (
    <nav aria-label="메인 탭" className="flex border-b border-line px-4">
      {items.map(([id, label, href]) => (
        <Link key={id} href={href} aria-current={active === id ? "page" : undefined}
          className={`-mb-px flex-1 border-b-2 px-4 py-2.5 text-center text-sm font-bold ${active === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
