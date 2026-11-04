"use client";

import { useCallback, useEffect, useState } from "react";

/** 최근 본 공연: 이 브라우저에만 저장해요(서버로 보내지 않아요). 기존 키와 따로 쓰는 새 키예요. */
export const RECENT_KEY = "jjabkit-recent-v1";
export const RECENT_MAX = 8;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
/** 맨 앞에 넣고 중복은 지우고, 개수를 넘으면 오래된 것부터 버려요. */
export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, RECENT_MAX);
}
export function recordRecent(id: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(readRecent(), id))); } catch { /* 저장 실패는 무시 */ }
}

export function useRecent(valid: Set<string>) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(readRecent().filter((id) => valid.has(id))); }, [valid]);
  const clear = useCallback(() => { try { localStorage.removeItem(RECENT_KEY); } catch { /* 무시 */ } setIds([]); }, []);
  return { ids, clear };
}
