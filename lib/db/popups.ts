import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError } from "./errors";
import type { Popup } from "@/types/popup";

const SELECT = "id, title, body, label, cta, link_url, image_url, gradient, starts_on, ends_on, active, sort_order, created_at";
interface Row { id: string; title: string; body: string; label: string; cta: string; link_url: string | null; image_url: string | null; gradient: string; starts_on: string | null; ends_on: string | null; active: boolean; sort_order: number; created_at: string }

const toPopup = (r: Row): Popup => ({
  id: r.id, title: r.title, body: r.body, label: r.label, cta: r.cta, linkUrl: r.link_url ?? "", imageUrl: r.image_url ?? "",
  gradient: r.gradient, startsOn: r.starts_on ?? "", endsOn: r.ends_on ?? "", active: r.active, sortOrder: r.sort_order, createdAt: r.created_at,
});

export interface PopupInput { title: string; body: string; label: string; cta: string; linkUrl: string; imageUrl: string; gradient: string; startsOn: string; endsOn: string; active: boolean; sortOrder: number }
const toColumns = (p: PopupInput) => ({
  title: p.title.trim(), body: p.body.trim(), label: p.label.trim(), cta: p.cta.trim() || "자세히 보기",
  link_url: p.linkUrl.trim() || null, image_url: p.imageUrl.trim() || null, gradient: p.gradient,
  starts_on: p.startsOn || null, ends_on: p.endsOn || null, active: p.active, sort_order: p.sortOrder,
});

/** 순서 번호가 작은 것부터, 같으면 먼저 만든 것부터. (방문자는 켜 둔 것만, 관리자는 전부 읽혀요 — RLS) */
export async function fetchPopups(db: SupabaseClient): Promise<Popup[]> {
  const { data, error } = await db.from("popups").select(SELECT).order("sort_order").order("created_at").limit(100);
  if (error) throw new DbError("팝업", error, "popups");
  return ((data ?? []) as unknown as Row[]).map(toPopup);
}
export async function fetchPopupsSafe(db: SupabaseClient): Promise<Popup[]> {
  try { return await fetchPopups(db); } catch (e) { if (e instanceof DbError && e.missing) return []; throw e; }
}

async function run<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
export const createPopup = (db: SupabaseClient, p: PopupInput) => run(db.from("popups").insert(toColumns(p)));
export const updatePopup = (db: SupabaseClient, id: string, p: PopupInput) => run(db.from("popups").update(toColumns(p)).eq("id", id));
export const deletePopup = (db: SupabaseClient, id: string) => run(db.from("popups").delete().eq("id", id));
