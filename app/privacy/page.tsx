import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";

export const revalidate = 300; // 캐시해 두고, 관리자에서 문구를 고치면 바로 새로 만들어요(/api/revalidate)
export const metadata: Metadata = { title: `${PAGE_DEFAULTS.privacy.title} - JJabKit` };

export default function Page() {
  return <InfoPage slug="privacy" />;
}
