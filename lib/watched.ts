"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isRealDate } from "./period";

/**
 * 관극 완료 기록. '내 일정'(jjabkit-mysched-v1)과는 저장 위치부터 따로예요.
 * - 내 일정에 있는 회차를 사용자가 직접 '관극 완료'로 표시했을 때만 기록이 생겨요. (자동 변환 없음)
 * - 공연 데이터가 나중에 바뀌어도 통계가 흔들리지 않게, 표시한 순간의 공연명·날짜·시간·출연 배우를 함께 적어 둬요.
 * - 기록은 회차 id(sessionId)를 최우선으로 구분해요. 공연명·날짜·시간은 id가 없는 예전 기록과 백업 파일을 위한 보조 수단이에요.
 *   (제목이 같고 날짜·시간까지 같은 서로 다른 공연이 있어도 기록이 하나로 합쳐지지 않아요.)
 */
export const WATCHED_KEY = "jjabkit-watched-v1";
export const WATCHED_VERSION = 1;
const MAX = 5000;

export interface WatchedRecord { show: string; showId: string; /** 회차 id. 예전 기록·예전 백업에는 비어 있을 수 있어요 */ sessionId: string; date: string; time: string; actors: string[]; at: string }

/** 같은 기록인지 가르는 식별자: 회차 id가 있으면 그것, 없으면 공연 id(없으면 공연명)+날짜+시간 */
export const recId = (r: { sessionId?: string; showId?: string; show: string; date: string; time: string }) =>
  r.sessionId ? `s:${r.sessionId}` : `c:${r.showId || ""}|${r.show}|${r.date}|${r.time}`;

/** 'HH:mm' 24시간제, 00:00~23:59 */
export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export interface Ref { sessionId: string; showId: string; show: string; date: string; time: string }
/** 이 기록이 그 회차를 가리키는지 */
export function matches(r: WatchedRecord, ref: Ref): boolean {
  if (r.sessionId) return r.sessionId === ref.sessionId;
  if (r.date !== ref.date || r.time !== ref.time) return false;
  return r.showId ? r.showId === ref.showId : r.show === ref.show;
}

export interface Rejected { index: number; reason: string }
export interface CleanResult { records: WatchedRecord[]; rejected: Rejected[]; total: number }

/** 저장값·백업 파일에서 온 값을 항목별로 검사해요. 잘못된 항목만 빼고 나머지는 살려요(전체를 버리지 않아요). */
export function cleanRecordsDetailed(raw: unknown): CleanResult {
  if (!Array.isArray(raw)) return { records: [], rejected: [], total: 0 };
  const seen = new Map<string, WatchedRecord>();
  const rejected: Rejected[] = [];
  raw.slice(0, MAX).forEach((x, index) => {
    const bad = (reason: string) => { rejected.push({ index, reason }); };
    if (typeof x !== "object" || x === null || Array.isArray(x)) return bad("항목 형식이 잘못됐어요");
    const r = x as Record<string, unknown>;
    if (typeof r.show !== "string" || !r.show.trim() || r.show.length > 200) return bad("공연명이 없거나 잘못됐어요");
    if (typeof r.date !== "string" || !isRealDate(r.date)) return bad(`날짜가 올바르지 않아요(${String(r.date).slice(0, 12)})`);
    if (typeof r.time !== "string" || !isValidTime(r.time)) return bad(`시간이 올바르지 않아요(${String(r.time).slice(0, 8)})`);
    const rec: WatchedRecord = {
      show: r.show, showId: typeof r.showId === "string" ? r.showId.slice(0, 80) : "", sessionId: typeof r.sessionId === "string" ? r.sessionId.slice(0, 80) : "",
      date: r.date, time: r.time,
      actors: (Array.isArray(r.actors) ? r.actors : []).filter((a): a is string => typeof a === "string" && a.length > 0 && a.length <= 50).slice(0, 30),
      at: typeof r.at === "string" ? r.at.slice(0, 40) : "",
    };
    if (!seen.has(recId(rec))) seen.set(recId(rec), rec);
  });
  return { records: [...seen.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), rejected, total: raw.length };
}
export const cleanRecords = (raw: unknown): WatchedRecord[] => cleanRecordsDetailed(raw).records;

interface ShowLite { id: string; title: string; sessions?: { id: string; date: string; time: string }[] }

/**
 * 기록을 지금 공연 데이터의 회차 id와 이어 줘요.
 * - 이미 살아 있는 회차 id면 그대로. 공연 id+날짜+시간이 딱 하나로 맞으면 거기에 연결.
 * - 공연 id로 못 찾을 때만(전체 교체 복원 등) 공연명+날짜+시간이 '딱 하나'로 맞을 때 연결해요.
 * - 둘 이상이 맞거나 하나도 없으면 임의로 고르지 않고 그대로 보관해요(통계에는 계속 들어가요).
 */
export function linkRecords(records: WatchedRecord[], shows: ShowLite[]): { records: WatchedRecord[]; changed: boolean } {
  if (shows.length === 0) return { records, changed: false };
  const live = new Map<string, { showId: string; title: string }>();
  const byShowSlot = new Map<string, string>(); // showId|date|time → sessionId
  const byTitleSlot = new Map<string, { sid: string; showId: string }[]>();
  const liveShow = new Set(shows.map((s) => s.id));
  for (const s of shows) for (const x of s.sessions ?? []) {
    live.set(x.id, { showId: s.id, title: s.title });
    byShowSlot.set(`${s.id}|${x.date}|${x.time}`, x.id);
    const k = `${s.title}|${x.date}|${x.time}`;
    byTitleSlot.set(k, [...(byTitleSlot.get(k) ?? []), { sid: x.id, showId: s.id }]);
  }
  let changed = false;
  const out = records.map((r) => {
    if (r.sessionId && live.has(r.sessionId)) {
      const l = live.get(r.sessionId)!;
      if (r.showId === l.showId) return r;
      changed = true; return { ...r, showId: l.showId };
    }
    let to: { sid: string; showId: string } | null = null;
    const sid = r.showId && liveShow.has(r.showId) ? byShowSlot.get(`${r.showId}|${r.date}|${r.time}`) : undefined;
    if (sid) to = { sid, showId: r.showId };
    else if (!r.showId || !liveShow.has(r.showId)) {
      const c = byTitleSlot.get(`${r.show}|${r.date}|${r.time}`) ?? [];
      if (c.length === 1) to = c[0];
    }
    if (!to) return r;
    changed = true;
    return { ...r, sessionId: to.sid, showId: to.showId };
  });
  if (!changed) return { records, changed: false };
  return { records: cleanRecords(out), changed: true };
}
/** 지금 공연 데이터의 어떤 회차와도 연결되지 않은 기록(사용자 확인이 필요해요) */
export function unlinkedOf(records: WatchedRecord[], shows: ShowLite[]): WatchedRecord[] {
  if (shows.length === 0) return [];
  const live = new Set(shows.flatMap((s) => (s.sessions ?? []).map((x) => x.id)));
  return records.filter((r) => !r.sessionId || !live.has(r.sessionId));
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
  const has = useCallback((ref: Ref) => records.some((x) => matches(x, ref)), [records]);
  const mark = useCallback((r: Omit<WatchedRecord, "at">) => {
    if (cache.some((x) => matches(x, r))) return;
    commit(cleanRecords([...cache, { ...r, at: new Date().toISOString() }]));
  }, []);
  const unmark = useCallback((ref: Ref) => commit(cache.filter((x) => !matches(x, ref))), []);
  /** 기록 한 건을 식별자로 지워요(통계 화면의 기록 목록용) */
  const removeRecord = useCallback((r: WatchedRecord) => commit(cache.filter((x) => recId(x) !== recId(r))), []);
  const replaceAll = useCallback((next: WatchedRecord[]) => commit(cleanRecords(next)), []);
  /** 공연 데이터가 바뀐 뒤 기록과 회차를 이어 줘요. 바뀐 게 없으면 저장하지 않아요. */
  const link = useCallback((shows: ShowLite[]) => { const r = linkRecords(cache, shows); if (r.changed) commit(r.records); }, []);
  /** 저장소에 지금 실제로 들어 있는 기록(복원 검증용) */
  const stored = useCallback((): WatchedRecord[] => { try { return cleanRecords(JSON.parse(localStorage.getItem(WATCHED_KEY) ?? "{}").records); } catch { return []; } }, []);
  return { records, has, mark, unmark, removeRecord, replaceAll, link, stored };
}
