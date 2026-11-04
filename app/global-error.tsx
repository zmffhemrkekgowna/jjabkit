"use client";

/** 맨 바깥(레이아웃)에서 오류가 났을 때의 마지막 안전망이에요. 이 화면은 스타일 파일 없이도 읽히게 만들었어요. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1rem", textAlign: "center", color: "#1B1A22", background: "#F4F4F9" }}>
        <main role="alert" style={{ maxWidth: 420, margin: "0 auto" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 700 }}>잠시 문제가 생겼어요</p>
          <p style={{ fontSize: "0.875rem", color: "#6A6877" }}>페이지를 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", border: 0, borderRadius: 8, background: "#8B1E3F", color: "#fff", fontWeight: 500, cursor: "pointer" }}>다시 시도</button>
        </main>
      </body>
    </html>
  );
}
