import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";

export const dynamic = "force-dynamic"; // 관리자에서 고친 문구가 바로 보이도록 캐시하지 않아요
export const metadata: Metadata = { title: `${PAGE_DEFAULTS.contact.title} - JJabKit` };

export default function Page() {
  return <InfoPage slug="contact" />;
}
