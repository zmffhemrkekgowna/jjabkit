import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notice, NoticeKind } from "@/types/notice";

const SELECT = "id, kind, title, body, show_id, pinned, created_at";

interface Row { id: string; kind: NoticeKind; title: string; body: string; show_id: string | null; pinned: boolean; created_at: string }

const toNotice = (r: Row): Notice => ({
  id: r.id, kind: r.kind, title: r.title, body: r.body, showId: r.show_id ?? "", pinned: r.pinned, createdAt: r.created_at,
});

export interface NoticeInput { kind: NoticeKind; title: string; body: string; showId: string; pinned: boolean }
const toColumns = (n: NoticeInput) => ({
  kind: n.kind, title: n.title.trim(), body: n.body.trim(), show_id: n.showId || null, pinned: n.pinned,
});

/** 고정 공지가 위, 그다음 최신순. */
export async function fetchNotices(db: SupabaseClient, limit = 30): Promise<Notice[]> {
  const { data, error } = await db.from("notices").select(SELECT)
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toNotice);
}

/** 화면 전체를 막지 않도록, 소식을 못 불러와도(표가 아직 없는 경우 등) 빈 목록을 돌려줘요. */
export async function fetchNoticesSafe(db: SupabaseClient): Promise<Notice[]> {
  try { return await fetchNotices(db); } catch { return []; }
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export const createNotice = (db: SupabaseClient, n: NoticeInput) => run(db.from("notices").insert(toColumns(n)));
export const updateNotice = (db: SupabaseClient, id: string, n: NoticeInput) => run(db.from("notices").update(toColumns(n)).eq("id", id));
export const deleteNotice = (db: SupabaseClient, id: string) => run(db.from("notices").delete().eq("id", id));
