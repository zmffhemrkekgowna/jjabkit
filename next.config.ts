import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 예전 주소로 들어와도 관리자 로그인 화면으로 안내해요.
  async redirects() {
    return [{ source: "/login", destination: "/admin/login", permanent: false }];
  },
  // 기본 보안 헤더: 다른 사이트가 이 앱을 프레임에 넣는 것(클릭재킹)과 형식 추측을 막아요.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
