import type { SupabaseClient } from "@supabase/supabase-js";
import { DbError, isMissingRelation } from "./errors";
import type { Popup } from "@/types/popup";

const SELECT = "id, title, body, label, cta, link_url, image_url, gradient, starts_on, ends_on, active, sort_order, created_at";
const SELECT_IO = SELECT.replace("image_url,", "image_url, image_only,"); // 0013(이미지만 표시) 이후
interface Row { id: string; title: string; body: string; label: string; cta: string; link_url: string | null; image_url: string | null; gradient: string; starts_on: string | null; ends_on: string | null; active: boolean; sort_order: number; created_at: string; image_only?: boolean }

const toPopup = (r: Row): Popup => ({
  id: r.id, title: r.title, body: r.body, label: r.label, cta: r.cta, linkUrl: r.link_url ?? "", imageUrl: r.image_url ?? "",
  gradient: r.gradient, startsOn: r.starts_on ?? "", endsOn: r.ends_on ?? "", imageOnly: !!r.image_only && !!r.image_url, active: r.active, sortOrder: r.sort_order, createdAt: r.created_at,
});

export interface PopupInput { title: string; body: string; label: string; cta: string; linkUrl: string; imageUrl: string; gradient: string; startsOn: string; endsOn: string; imageOnly: boolean; active: boolean; sortOrder: number }
// image_only 칸은 켤 때(또는 꺼야 할 때)만 보내요. 0013을 아직 안 돌린 DB에서도 다른 저장이 그대로 되게 하려는 거예요.
const toColumns = (p: PopupInput, withImageOnly = false) => ({
  title: p.title.trim(), body: p.body.trim(), label: p.label.trim(), cta: p.cta.trim() || "자세히 보기",
  link_url: p.linkUrl.trim() || null, image_url: p.imageUrl.trim() || null, gradient: p.gradient,
  starts_on: p.startsOn || null, ends_on: p.endsOn || null, active: p.active, sort_order: p.sortOrder,
  ...(p.imageOnly || withImageOnly ? { image_only: p.imageOnly && !!p.imageUrl.trim() } : {}),
});

/** 순서 번호가 작은 것부터, 같으면 먼저 만든 것부터. (방문자는 켜 둔 것만, 관리자는 전부 읽혀요 — RLS) */
export async function fetchPopups(db: SupabaseClient): Promise<Popup[]> {
  const q = (cols: string) => db.from("popups").select(cols).order("sort_order").order("created_at").limit(100);
  let { data, error } = await q(SELECT_IO);
  if (error && /image_only/i.test(error.message ?? "") && !isMissingRelation(error, "popups")) ({ data, error } = await q(SELECT)); // 0013 전
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
export const updatePopup = (db: SupabaseClient, id: string, p: PopupInput, hadImageOnly = false) => run(db.from("popups").update(toColumns(p, hadImageOnly)).eq("id", id));
/** 팝업 이미지를 포스터와 같은 저장 공간(posters)의 popups/ 폴더에 올리고 공개 주소를 돌려줘요. (새 DB 설정 없이 지금 권한 그대로 써요) */
export const POPUP_IMAGE_MAX_MB = 5;
export async function uploadPopupImage(db: SupabaseClient, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일(JPG·PNG·WebP·GIF)만 올릴 수 있어요.");
  if (file.size > POPUP_IMAGE_MAX_MB * 1024 * 1024) throw new Error(`이미지가 너무 커요. ${POPUP_IMAGE_MAX_MB}MB 이하로 줄여서 올려 주세요.`);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `popups/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage.from("posters").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return db.storage.from("posters").getPublicUrl(path).data.publicUrl;
}
export const deletePopup = (db: SupabaseClient, id: string) => run(db.from("popups").delete().eq("id", id));
