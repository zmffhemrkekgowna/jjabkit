"use client";

/**
 * 관리자 저장 후 캐시해 둔 사용자 화면을 새로 만들게 해요(/api/revalidate). 실패해도 저장 자체에는 영향이 없어요.
 * 연달아 저장하면(회차 여러 개 입력 등) 마지막 저장 1.5초 뒤 한 번만 불러요 — 저장할 때마다 화면 전체를
 * 새로 만들면 Vercel CPU를 그만큼 쓰기 때문이에요. 기다리는 중에 화면을 떠나면 바로 보내요.
 */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;
let afterSend: (() => void) | null = null;

/** 보낸 뒤 할 일(관리자 화면의 브라우저 캐시 비우기 등)을 등록해요. */
export function setAfterPublicRefresh(fn: (() => void) | null) { afterSend = fn; }

function send(keepalive = false): Promise<void> {
  pendingTimer = null;
  return fetch("/api/revalidate", { method: "POST", credentials: "same-origin", keepalive })
    .then(() => { try { afterSend?.(); } catch { /* 무시 */ } }, () => undefined);
}

export function refreshPublicPages(): void {
  if (typeof window === "undefined") return;
  if (!hooked) {
    hooked = true;
    const flush = () => { if (pendingTimer) { clearTimeout(pendingTimer); void send(true); } };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  }
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => { void send(); }, 1500);
}

/** 기다리는 갱신이 있으면 지금 바로 보내요(관리자 → 사용자 화면으로 이동할 때). 없으면 아무것도 안 해요. */
export async function flushPublicRefresh(): Promise<void> {
  if (!pendingTimer) return;
  clearTimeout(pendingTimer);
  await send();
}
