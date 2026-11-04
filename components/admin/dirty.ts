"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * '저장 안 된 입력' 모음. 입력 중인 폼이 여기에 등록하면, 탭을 옮기거나 목록으로 돌아가거나 창을 닫을 때 경고하고
 * 관리자 화면 위쪽에 알림 띠가 떠요. 입력을 저장하거나 비우면 자동으로 빠져요.
 */
const map = new Map<string, string>();
const subs = new Set<() => void>();
let snap = "";
const emit = () => { snap = [...map.values()].join(" · "); subs.forEach((f) => f()); };

/** isDirty가 true인 동안 label(예: "회차 추가 입력")이 '저장 안 된 입력'으로 등록돼요. */
export function useDirty(key: string, label: string, isDirty: boolean) {
  useEffect(() => {
    if (isDirty) map.set(key, label); else map.delete(key);
    emit();
    return () => { map.delete(key); emit(); };
  }, [key, label, isDirty]);
}

/** 지금 저장 안 된 입력들의 이름(없으면 빈 글자) */
export function useDirtyLabels(): string {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => snap, () => "");
}

/** 저장 안 된 입력이 있으면 확인을 받아요. 계속해도 되면 true. */
export function confirmDiscard(): boolean {
  if (map.size === 0 || typeof window === "undefined") return true;
  return window.confirm(`저장하지 않은 입력이 있어요 (${[...map.values()].join(", ")}). 나가면 사라져요. 계속할까요?`);
}

/** 창을 닫거나 새로고침할 때 브라우저 기본 경고 */
export function useBeforeUnloadGuard() {
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (map.size > 0) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, []);
}
