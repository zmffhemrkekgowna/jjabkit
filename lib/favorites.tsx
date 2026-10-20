"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** 관심 공연은 공연 id, 관심 배우는 이름으로 저장해요. (같은 배우가 여러 공연에 나와도 한 번에 모아볼 수 있어요) */
const KEY = "myukit-fav-v1";
interface Stored { shows: Set<string>; actors: Set<string> }
interface Favorites extends Stored {
  ready: boolean;
  toggleShow: (id: string) => void;
  toggleActor: (name: string) => void;
  /** 더 이상 없는 공연의 하트를 지워요 */
  pruneShows: (valid: Set<string>) => void;
  /** 백업 파일에서 불러올 때: 관심 공연·배우를 통째로 바꿔요 */
  replaceAll: (shows: Set<string>, actors: Set<string>) => void;
}

const empty = (): Stored => ({ shows: new Set(), actors: new Set() });
function read(): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { shows: new Set<string>(v.shows ?? []), actors: new Set<string>(v.actors ?? []) };
  } catch {
    return empty();
  }
}

const Ctx = createContext<Favorites | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(empty);
  const [ready, setReady] = useState(false);

  // 저장값은 브라우저에서만 읽을 수 있어서 마운트 후에 불러와요. (서버 렌더링과 어긋나지 않게)
  useEffect(() => {
    setState(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setState(read()); };
    window.addEventListener("storage", onStorage); // 다른 탭에서 바꾼 하트도 반영
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ shows: [...state.shows], actors: [...state.actors] })); } catch { /* 저장 실패는 무시 */ }
  }, [state, ready]);

  const flip = useCallback((kind: keyof Stored, v: string) => {
    setState((prev) => {
      const next = { shows: new Set(prev.shows), actors: new Set(prev.actors) };
      if (next[kind].has(v)) next[kind].delete(v); else next[kind].add(v);
      return next;
    });
  }, []);

  const pruneShows = useCallback((valid: Set<string>) => {
    setState((prev) => {
      const keep = [...prev.shows].filter((id) => valid.has(id));
      return keep.length === prev.shows.size ? prev : { ...prev, shows: new Set(keep) };
    });
  }, []);

  const replaceAll = useCallback((shows: Set<string>, actors: Set<string>) => setState({ shows: new Set(shows), actors: new Set(actors) }), []);

  const value = useMemo<Favorites>(
    () => ({ ...state, ready, toggleShow: (id) => flip("shows", id), toggleActor: (n) => flip("actors", n), pruneShows, replaceAll }),
    [state, ready, flip, pruneShows, replaceAll]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): Favorites {
  const v = useContext(Ctx);
  if (!v) throw new Error("FavoritesProvider 안에서만 쓸 수 있어요.");
  return v;
}
