/** 사이트 주소. 링크 미리보기(카톡·SNS)에서 이미지·주소를 만들 때 써요.
 *  NEXT_PUBLIC_SITE_URL 이 있으면 그걸 쓰고(도메인을 산 뒤 여기에 넣어요),
 *  없으면 Vercel이 자동으로 넣어 주는 주소를 써요. 둘 다 없으면(내 컴퓨터) localhost예요. */
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    || "http://localhost:3000";
  try { return new URL(raw.startsWith("http") ? raw : `https://${raw}`); } catch { return new URL("http://localhost:3000"); }
}
