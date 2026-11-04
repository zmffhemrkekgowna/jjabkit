"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * 내 일정: 사용자가 '내 일정 추가'를 눌러 직접 고른 회차의 고유 id를 이 브라우저에 저장해요.
 * 관심 배우(하트)와는 저장 위치(키)부터 따로예요. 관심 배우를 등록해도 여기에는 아무것도 추가되지 않아요.
 * 같은 id는 한 번만 저장되므로(집합) 같은 회차가 중복으로 등록되지 않아요.
 */
export const MYSCHED_KEY = "jjabkit-mysched-v1";

interface MySched {
  ready: boolean;
  ids: Set<string>;
  has: (sessionId: string) => boolean;
  add: (sessionId: string) => void;
  remove: (sessionId: string) => void;
  toggle: (sessionId: string) => void;
  /** 삭제된 회차의 id를 정리해요 */
  prune: (valid: Set<string>) => void;
  /** 백업 불러오기용: 전체를 한 번에 바꿔요 */
  replaceAll: (ids: Set<string>) => void;
}

function read(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(MYSCHED_KEY) ?? "{}");
    return new Set<string>(Array.isArray(v.sessions) ? v.sessions.filter((x: unknown): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

const Ctx = createContext<MySched | null>(null);

export function MySchedProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  // 저장값은 브라우저에서만 읽을 수 있어서 마운트 후에 불러와요. (서버 렌더링과 어긋나지 않게)
  useEffect(() => {
    setIds(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === MYSCHED_KEY) setIds(read()); };
    window.addEventListener("storage", onStorage); // 다른 탭에서 바꾼 일정도 반영
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(MYSCHED_KEY, JSON.stringify({ sessions: [...ids] })); } catch { /* 저장 실패는 무시 */ }
  }, [ids, ready]);

  const add = useCallback((id: string) => setIds((p) => (p.has(id) ? p : new Set(p).add(id))), []);
  const remove = useCallback((id: string) => setIds((p) => { if (!p.has(id)) return p; const n = new Set(p); n.delete(id); return n; }), []);
  const toggle = useCallback((id: string) => setIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const prune = useCallback((valid: Set<string>) => setIds((p) => {
    const keep = [...p].filter((id) => valid.has(id));
    return keep.length === p.size ? p : new Set(keep);
  }), []);

  const replaceAll = useCallback((next: Set<string>) => setIds(new Set(next)), []);

  const value = useMemo<MySched>(() => ({ ready, ids, has: (id) => ids.has(id), add, remove, toggle, prune, replaceAll }), [ready, ids, add, remove, toggle, prune, replaceAll]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMySched(): MySched {
  const v = useContext(Ctx);
  if (!v) throw new Error("MySchedProvider 안에서만 쓸 수 있어요.");
  return v;
}
