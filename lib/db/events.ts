import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventItem, EventScope } from "@/types/event";
import { DbError, isMissingRelation } from "./errors";

// 표에는 body·place 칸이 남아 있지만(기본값 '') 더는 쓰지 않아요. 예전 데이터는 지우지 않고 그대로 둬요.
const SELECT_BASE = "id, title, starts_on, ends_on, link_url, show_id, created_at";
const SELECT_COLOR = `${SELECT_BASE}, color`;
const SELECT = `${SELECT_COLOR}, scope, session_keys`;
interface Row { scope?: string | null; session_keys?: string[] | null; color?: string | null; id: string; title: string; starts_on: string | null; ends_on: string | null; link_url: string | null; show_id: string | null; created_at: string }

const toEvent = (r: Row): EventItem => ({
  id: r.id, title: r.title, startsOn: r.starts_on ?? "", endsOn: r.ends_on ?? "",
  linkUrl: r.link_url ?? "", showId: r.show_id ?? "", color: r.color ?? "", createdAt: r.created_at,
  // 0011 전 DB(칸이 없음)나 값이 비어 있는 예전 이벤트는 기존 방식(기간)이에요.
  scope: (r.scope === "all" || r.scope === "sessions" ? r.scope : "range") as EventScope,
  sessionKeys: r.scope === "sessions" && Array.isArray(r.session_keys) ? r.session_keys : [],
});

export interface EventInput { title: string; startsOn: string; endsOn: string; linkUrl: string; color: string; scope?: EventScope; sessionKeys?: string[] }
/** color 칸은 0006을 실행해야 생겨요. 색을 안 쓰면(처음 저장 + 기본색) 보내지 않아서 0006 전에도 저장돼요. */
const toColumns = (e: EventInput, withColor: boolean, withScope = false) => ({
  title: e.title.trim(), starts_on: e.startsOn || null, ends_on: e.endsOn || null, link_url: e.linkUrl.trim() || null,
  ...(withColor ? { color: e.color || null } : {}),
  // scope·session_keys 칸은 0011을 실행해야 생겨요. 기간 방식(기존)이고 원래도 칸이 없던 이벤트는 보내지 않아서 0011 전에도 저장돼요.
  ...(withScope || (e.scope && e.scope !== "range") ? { scope: e.scope ?? "range", session_keys: e.scope === "sessions" ? e.sessionKeys ?? [] : null } : {}),
});

/** 시작하는 날 순서(같으면 먼저 만든 것부터). */
export async function fetchEvents(db: SupabaseClient, limit = 500): Promise<EventItem[]> {
  const q = (cols: string) => db.from("events").select(cols).order("created_at", { ascending: true }).limit(limit);
  let { data, error } = await q(SELECT);
  // 0011(scope 칸)·0006(color 칸)을 아직 안 돌렸으면 있는 칸만으로 다시 불러와요. 이벤트가 통째로 사라지면 안 돼요.
  if (error && /scope|session_keys/i.test(error.message) && !isMissingRelation(error, "events")) ({ data, error } = await q(SELECT_COLOR));
  if (error && /color/i.test(error.message) && !isMissingRelation(error, "events")) ({ data, error } = await q(SELECT_BASE));
  if (error) throw new DbError("이벤트", error, "events");
  return ((data ?? []) as unknown as Row[]).map(toEvent).sort((a, b) => (a.startsOn || "9999").localeCompare(b.startsOn || "9999"));
}

/** 이벤트 표가 아직 없는 DB(0004 전)는 빈 목록이에요. 그 밖의 조회 실패는 숨기지 않고 오류로 올려요(화면의 '다시 시도'가 떠요). */
export async function fetchEventsSafe(db: SupabaseClient): Promise<EventItem[]> {
  try { return await fetchEvents(db); } catch (e) { if (e instanceof DbError && e.missing) return []; throw e; }
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
/** 이벤트는 항상 한 공연에 속해요(showId). */
export const createEvent = (db: SupabaseClient, showId: string, e: EventInput) =>
  run(db.from("events").insert({ ...toColumns(e, !!e.color), show_id: showId }));
/** hadColor: 원래 색이 있던 이벤트(기본색으로 되돌릴 때 null로 지워야 해요) */
export const updateEvent = (db: SupabaseClient, id: string, e: EventInput, hadColor = false, hadScope = false) =>
  run(db.from("events").update(toColumns(e, !!e.color || hadColor, hadScope)).eq("id", id));
export const deleteEvent = (db: SupabaseClient, id: string) => run(db.from("events").delete().eq("id", id));
/** 삭제한 이벤트를 같은 id 그대로 되살려요(실행 취소용). */
export const restoreEvents = (db: SupabaseClient, events: EventItem[]) =>
  events.length === 0 ? Promise.resolve(null) : run(db.from("events").insert(events.map((e) => ({
    id: e.id, ...toColumns({ title: e.title, startsOn: e.startsOn, endsOn: e.endsOn, linkUrl: e.linkUrl, color: e.color, scope: e.scope, sessionKeys: e.sessionKeys }, !!e.color), show_id: e.showId || null }))));
/** 공연의 이벤트를 모두 지워요('이벤트 있음' 체크를 끌 때, 공연을 지울 때). */
export const deleteEventsOfShow = (db: SupabaseClient, showId: string) => run(db.from("events").delete().eq("show_id", showId));
