import GuideDetail, { generateMetadata as detailMetadata } from "../[slug]/page";

export const dynamic = "force-dynamic";

// '팝업 광고 문의'는 관리자 화면 > 안내 페이지에서 고칠 수 있는 일반 안내 페이지(주소 popup-ads)예요.
// 이 파일은 예전에 만든 고정 페이지를 대체해서, 같은 주소를 DB의 페이지로 연결해 줘요.
const params = () => Promise.resolve({ slug: "popup-ads" });
export const generateMetadata = () => detailMetadata({ params: params() });
export default function PopupAdsPage() { return GuideDetail({ params: params() }); }
