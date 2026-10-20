import type { SupabaseClient } from "@supabase/supabase-js";
import type { Genre, SessionInput, Show, ShowPatch, Status } from "@/types/show";

const SELECT = `
  id, title, genre, status, start_date, end_date, venue, region, age_rating,
  runtime_text, early_bird_text, poster_url, poster_palette,
  roles ( id, name, short_name, sort_order, cast_members ( id, name, sort_order ) ),
  sessions ( id, starts_on, starts_at, is_curtain_call, is_time_sale,
             session_cast ( role_id, cast_member_id ) )
`;

interface ShowRow {
  id: string; title: string; genre: Genre; status: Status;
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
    status: r.status,
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

/* ---------- 조회 (사용자 화면) ---------- */
export async function fetchShows(db: SupabaseClient): Promise<Show[]> {
  const rows = await run(db.from("shows").select(SELECT).order("start_date", { ascending: true }));
  return (rows as unknown as ShowRow[]).map(toShow);
}

export async function fetchShow(db: SupabaseClient, id: string): Promise<Show | null> {
  const row = await run(db.from("shows").select(SELECT).eq("id", id).maybeSingle());
  return row ? toShow(row as unknown as ShowRow) : null;
}

/* ---------- 공연 ---------- */
const COLUMNS: Record<keyof ShowPatch, string> = {
  title: "title", genre: "genre", status: "status", start: "start_date", end: "end_date",
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

export async function deleteShow(db: SupabaseClient, id: string): Promise<void> {
  await run(db.from("shows").delete().eq("id", id));
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
export const deleteSession = (db: SupabaseClient, id: string) => run(db.from("sessions").delete().eq("id", id));

/* ---------- 포스터 이미지 ---------- */
export async function uploadPoster(db: SupabaseClient, showId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${showId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("posters").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return db.storage.from("posters").getPublicUrl(path).data.publicUrl;
}
