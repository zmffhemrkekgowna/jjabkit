/**
 * 사용자 화면 캐시 정책 (Vercel 사용량 절약)
 * - 사용자 화면은 한 번 만들어 두고 여러 방문자에게 그대로 보여줘요. 방문할 때마다 서버가 새로 만들지 않아요.
 * - 관리자 화면에서 저장하면 /api/revalidate가 바로 새로 만들게 해요(즉시 반영).
 * - 혹시 빠진 저장 경로가 있어도, 아래 시간(초)이 지나면 자동으로 새로 만들어요(안전장치).
 *   ※ Next.js 규칙상 각 page.tsx의 `export const revalidate`에는 숫자를 직접 적어야 해서, 값을 바꿀 땐 각 파일도 같이 바꿔요.
 */
export const PUBLIC_REVALIDATE_SECONDS = 300;
