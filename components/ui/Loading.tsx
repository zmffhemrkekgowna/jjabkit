import LoadingSlowHint from "./LoadingSlowHint";

/**
 * 짭킷 공통 로딩 표시. 이미지 없이 CSS만으로 도는 버건디 원(globals.css의 .jjk-spinner)이에요.
 * - 0.4초 안에 끝나는 짧은 로딩에서는 보이지 않아요(.jjk-delay) — 깜빡임 방지. 화면 읽기 프로그램에는 바로 알려요.
 * - 데이터가 오면 이 컴포넌트를 감싼 쪽(loading.tsx의 Suspense, 또는 상태값)이 없애므로 따로 끄는 코드가 없어요.
 */
export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  return <span aria-hidden className={`jjk-spinner inline-block shrink-0 ${size === "sm" ? "h-4 w-4 border-2" : "h-10 w-10 border-4"}`} />;
}

/** 화면(페이지 영역) 가운데에 띄우는 로딩. slowHint를 켜면 오래 걸릴 때 새로고침 안내가 나와요. */
export function LoadingScreen({ label = "불러오는 중...", slowHint = false }: { label?: string; slowHint?: boolean }) {
  return (
    <div role="status" aria-live="polite" data-testid="loading-screen" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="jjk-delay flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-xs text-mute">{label}</p>
      </div>
      {slowHint && <LoadingSlowHint />}
    </div>
  );
}

/** 글줄 안에 넣는 작은 로딩(관리자 화면의 표·목록 조회 등). */
export function LoadingInline({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" data-testid="loading-inline" className="jjk-delay flex items-center gap-2 text-sm text-mute">
      <Spinner size="sm" />{label}
    </p>
  );
}
