import Link from "next/link";

/** 모든 화면 맨 아래의 안내 링크. 광고(애드센스) 심사에 필요한 소개·개인정보처리방침·문의로 이어져요. */
export default function SiteFooter() {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-6 pt-8 text-center text-xs text-mute">
      <nav aria-label="사이트 안내" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/guide" className="font-medium hover:text-brand">이용 안내</Link>
        <Link href="/about" className="hover:text-brand">소개</Link>
        <Link href="/privacy" className="font-medium hover:text-brand">개인정보처리방침</Link>
        <Link href="/contact" className="hover:text-brand">문의</Link>
      </nav>
      <p className="mt-2">© JJabKit(짭킷)</p>
    </footer>
  );
}
