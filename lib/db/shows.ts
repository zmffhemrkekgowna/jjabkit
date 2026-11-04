import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError } from "./errors";
import type { Genre, Session, SessionInput, Show, ShowPatch } from "@/types/show";

const SELECT = `
  id, title, genre, start_date, end_date, venue, region, age_rating,
  runtime_text, early_bird_text, poster_url, poster_palette,
  roles ( id, name, short_name, sort_order, cast_members ( id, name, sort_order ) ),
  sessions ( id, starts_on, starts_at, is_curtain_call, is_time_sale,
             session_cast ( role_id, cast_member_id ) )
`;

interface ShowRow {
  id: string; title: string; genre: Genre;
  start_date: string | null; end_date: string | null;
  venue: string; region: string; age_rating: string; runtime_text: string; early_bird_text: string;
  poster_url: string | null; poster_palette: string;
  roles: {
    id: string; name: string; short_name: string; sort_order: number;
    cast_members: { id: string; name: string; sort_order: number }[];
  }[];
  sessions: {
    id: string; starts_on: string; starts_at: string; is_curtain_call: boolean; is_time_sale: boolean;
    session_cast: { role_id: string; cast_member_id: string | null }[];
  }[];
}

function toShow(r: ShowRow): Show {
  return {
    id: r.id,
    title: r.title,
    genre: r.genre,
    start: r.start_date ?? "",
    end: r.end_date ?? "",
    venue: r.venue,
    region: r.region,
    age: r.age_rating,
    run: r.runtime_text,
    eb: r.early_bird_text,
    grad: r.poster_palette,
    img: r.poster_url ?? "",
    poster: r.title.split(" ").filter(Boolean),
    roles: [...r.roles]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ro) => ({
        id: ro.id,
        name: ro.name,
        short: ro.short_name,
        actors: [...ro.cast_members]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => ({ id: c.id, n: c.name })),
      })),
    sessions: r.sessions.map((s) => ({
      id: s.id,
      date: s.starts_on,
      time: s.starts_at.slice(0, 5), // 'HH:MM:SS' -> 'HH:MM'
      curtain: s.is_curtain_call,
      timesale: s.is_time_sale,
      cast: Object.fromEntries(s.session_cast.map((c) => [c.role_id, c.cast_member_id ?? ""])),
    })),
  };
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

/** DB 응답이 기대한 모양인지 확인해요(스키마가 어긋났을 때 화면 깊은 곳에서 터지지 않고 여기서 분명히 실패하게). */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function isShowRow(v: unknown): v is ShowRow {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.title !== "string" || !Array.isArray(v.roles) || !Array.isArray(v.sessions)) return false;
  return v.roles.every((r) => isObj(r) && typeof r.id === "string" && Array.isArray(r.cast_members))
    && v.sessions.every((s) => isObj(s) && typeof s.id === "string" && typeof s.starts_on === "string" && typeof s.starts_at === "string" && Array.isArray(s.session_cast));
}
function asShowRows(data: unknown): ShowRow[] {
  if (!Array.isArray(data) || !data.every(isShowRow)) throw new DbError("공연", { code: "SHAPE", message: "unexpected response shape" });
  return data;
}

/* ---------- 조회 (사용자 화면) ---------- */
export async function fetchShows(db: SupabaseClient): Promise<Show[]> {
  const rows = await run(db.from("shows").select(SELECT).order("start_date", { ascending: true }));
  return asShowRows(rows).map(toShow);
}

export async function fetchShow(db: SupabaseClient, id: string): Promise<Show | null> {
  const row = await run(db.from("shows").select(SELECT).eq("id", id).maybeSingle());
  if (!row) return null;
  return toShow(asShowRows([row])[0]);
}

/* ---------- 공연 ---------- */
const COLUMNS: Record<keyof ShowPatch, string> = {
  title: "title", genre: "genre", start: "start_date", end: "end_date",
  venue: "venue", region: "region", age: "age_rating", run: "runtime_text", eb: "early_bird_text",
  grad: "poster_palette", img: "poster_url",
};
const NULLABLE = new Set<keyof ShowPatch>(["start", "end", "img"]);

function toColumns(patch: ShowPatch) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof ShowPatch)[]) {
    const v = patch[k] as string;
    out[COLUMNS[k]] = NULLABLE.has(k) && v === "" ? null : v;
  }
  return out;
}

export async function createShow(db: SupabaseClient, patch: ShowPatch = {}): Promise<string> {
  const row = await run(db.from("shows").insert(toColumns({ title: "새 공연", ...patch })).select("id").single());
  return (row as { id: string }).id;
}

export async function updateShow(db: SupabaseClient, id: string, patch: ShowPatch): Promise<void> {
  await run(db.from("shows").update(toColumns(patch)).eq("id", id));
}

/* ---------- 배역 / 배우 ---------- */
const shortOf = (name: string) => name.split(/[·\s]/)[0] || name;

export async function addRole(db: SupabaseClient, showId: string, name: string, sort: number) {
  const row = await run(
    db.from("roles").insert({ show_id: showId, name, short_name: shortOf(name), sort_order: sort }).select("id").single()
  );
  return (row as { id: string }).id;
}
export const renameRole = (db: SupabaseClient, id: string, name: string) =>
  run(db.from("roles").update({ name, short_name: shortOf(name) }).eq("id", id));
export const deleteRole = (db: SupabaseClient, id: string) => run(db.from("roles").delete().eq("id", id));

export async function addCastMember(db: SupabaseClient, roleId: string, name: string, sort: number) {
  const row = await run(
    db.from("cast_members").insert({ role_id: roleId, name, sort_order: sort }).select("id").single()
  );
  return (row as { id: string }).id;
}
export const renameCastMember = (db: SupabaseClient, id: string, name: string) =>
  run(db.from("cast_members").update({ name }).eq("id", id));
/** 삭제하면 그 배우가 지정된 회차는 DB가 자동으로 '미정'(null)으로 바꿔요. */
export const deleteCastMember = (db: SupabaseClient, id: string) => run(db.from("cast_members").delete().eq("id", id));

/* ---------- 회차 ---------- */
/** id가 없으면 추가, 있으면 수정. 같은 날짜·시간이 있으면 unique 오류가 나요. */
export async function saveSession(db: SupabaseClient, showId: string, s: SessionInput, id?: string) {
  return (await run(
    db.rpc("save_session", {
      p_id: id ?? null, p_show_id: showId, p_date: s.date, p_time: s.time,
      p_curtain: s.curtain, p_timesale: s.timesale, p_cast: s.cast,
    })
  )) as string;
}
/** 회차를 삭제해요. 여러 개여도 DB에서 한 번에(전부 지우거나 아무것도 안 지우거나) 처리해요. */
export async function deleteSessions(db: SupabaseClient, showId: string, ids: string[]): Promise<number> {
  return Number(await run(db.rpc("delete_sessions", { p_show_id: showId, p_ids: ids })));
}

/** 여러 회차를 한 번에 수정해요(하나라도 실패하면 전부 취소). cast를 주면 그 회차의 캐스팅을 통째로 바꾸고, 안 주면 캐스팅은 그대로예요. */
export interface SessionChange { id: string; date: string; time: string; curtain?: boolean; timesale?: boolean; cast?: Record<string, string> }
export async function bulkUpdateSessions(db: SupabaseClient, showId: string, items: SessionChange[]): Promise<number> {
  return Number(await run(db.rpc("bulk_update_sessions", { p_show_id: showId, p_items: items })));
}

/** 복구 결과: uncast = 배우가 사라져 '미정'으로 돌아온 배역 수, dropped = 배역 자체가 없어져 복구하지 못한 캐스팅 줄 수 */
export interface RestoreReport { uncast: number; dropped: number }
const reportOf = (r: unknown): RestoreReport => {
  const o = (r ?? {}) as Record<string, unknown>;
  return { uncast: Number(o.uncast) || 0, dropped: Number(o.dropped) || 0 };
};
/** 복구 결과를 사용자에게 알릴 문장으로 */
export const restoreNote = (res: unknown) => {
  const r = reportOf(res);
  return [r.uncast ? `배우가 사라진 캐스팅 ${r.uncast}건은 '미정'으로 돌아왔어요.` : "", r.dropped ? `배역이 사라져 복구하지 못한 캐스팅 ${r.dropped}건이 있어요.` : ""].filter(Boolean).join(" ");
};

/** 삭제한 회차를 같은 id 그대로 되살려요(사용자의 '내 일정'이 끊기지 않게). 복구할 수 있는 배우는 그대로 복구하고, 사라진 배우의 배역만 '미정'이 돼요. */
export async function restoreSessions(db: SupabaseClient, showId: string, sessions: Session[]): Promise<RestoreReport> {
  if (sessions.length === 0) return { uncast: 0, dropped: 0 };
  const payload = sessions.map((s) => ({ id: s.id, date: s.date, time: s.time, curtain: s.curtain, timesale: s.timesale, cast: s.cast }));
  return reportOf(await run(db.rpc("restore_sessions", { p_show_id: showId, p_sessions: payload })));
}

/** 공연과 딸린 모든 데이터(배역·배우·회차·캐스팅·이벤트)를 DB에서 한 번에 지우고, 되살릴 때 쓸 원본을 돌려받아요. */
export type ShowBundle = Record<string, unknown>;
export async function deleteShowBundle(db: SupabaseClient, id: string): Promise<ShowBundle> {
  return (await run(db.rpc("delete_show_bundle", { p_id: id }))) as ShowBundle;
}
/** deleteShowBundle이 돌려준 원본으로 같은 id 그대로 되살려요(전부 되거나 전부 안 되거나). */
export async function restoreShowBundle(db: SupabaseClient, bundle: ShowBundle): Promise<RestoreReport> {
  return reportOf(await run(db.rpc("restore_show_bundle", { p_bundle: bundle })));
}

/* ---------- 포스터 이미지 ---------- */
export async function uploadPoster(db: SupabaseClient, showId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${showId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("posters").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return db.storage.from("posters").getPublicUrl(path).data.publicUrl;
}
