"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * 관극 완료 기록. '내 일정'(jjabkit-mysched-v1)과는 저장 위치부터 따로예요.
 * - 내 일정에 있는 회차를 사용자가 직접 '관극 완료'로 표시했을 때만 기록이 생겨요. (자동 변환 없음)
 * - 공연 데이터가 나중에 바뀌어도 통계가 흔들리지 않게, 표시한 순간의 공연명·날짜·시간·출연 배우를 함께 적어 둬요.
 * - 같은 회차(공연명+날짜+시간)는 한 번만 기록돼요(중복 집계 없음).
 */
export const WATCHED_KEY = "jjabkit-watched-v1";
export const WATCHED_VERSION = 1;
const MAX = 5000;

export interface WatchedRecord { show: string; showId: string; date: string; time: string; actors: string[]; at: string }
export const watchedKey = (r: { show: string; date: string; time: string }) => `${r.show}|${r.date}|${r.time}`;

const isRec = (x: unknown): x is WatchedRecord => {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return typeof r.show === "string" && r.show.length > 0 && r.show.length <= 200 && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time) && Array.isArray(r.actors);
};
/** 저장값·백업 파일에서 온 값을 검사하고 정리해요(형식이 틀린 항목은 버리고, 중복은 합쳐요). */
export function cleanRecords(raw: unknown): WatchedRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Map<string, WatchedRecord>();
  for (const x of raw.slice(0, MAX)) {
    if (!isRec(x)) continue;
    const r: WatchedRecord = {
      show: x.show, showId: typeof x.showId === "string" ? x.showId : "", date: x.date, time: x.time,
      actors: x.actors.filter((a): a is string => typeof a === "string" && a.length > 0 && a.length <= 50).slice(0, 30),
      at: typeof x.at === "string" ? x.at : "",
    };
    if (!seen.has(watchedKey(r))) seen.set(watchedKey(r), r);
  }
  return [...seen.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

let cache: WatchedRecord[] = [];
let loaded = false;
const subs = new Set<() => void>();
function load() {
  try { const v = JSON.parse(localStorage.getItem(WATCHED_KEY) ?? "{}"); cache = cleanRecords(v.records); } catch { cache = []; }
  loaded = true;
}
function commit(next: WatchedRecord[]) {
  cache = next;
  try { localStorage.setItem(WATCHED_KEY, JSON.stringify({ v: WATCHED_VERSION, records: next })); } catch { /* 저장 실패는 무시 */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const EMPTY: WatchedRecord[] = [];

export function useWatched() {
  const records = useSyncExternalStore(subscribe, () => cache, () => EMPTY);
  useEffect(() => {
    if (!loaded) { load(); subs.forEach((f) => f()); }
    const onStorage = (e: StorageEvent) => { if (e.key === WATCHED_KEY) { load(); subs.forEach((f) => f()); } };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const has = useCallback((r: { show: string; date: string; time: string }) => records.some((x) => watchedKey(x) === watchedKey(r)), [records]);
  const mark = useCallback((r: Omit<WatchedRecord, "at">) => {
    if (cache.some((x) => watchedKey(x) === watchedKey(r))) return;
    commit(cleanRecords([...cache, { ...r, at: new Date().toISOString() }]));
  }, []);
  const unmark = useCallback((r: { show: string; date: string; time: string }) => commit(cache.filter((x) => watchedKey(x) !== watchedKey(r))), []);
  const replaceAll = useCallback((next: WatchedRecord[]) => commit(cleanRecords(next)), []);
  return { records, has, mark, unmark, replaceAll };
}
