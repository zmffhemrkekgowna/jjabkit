import type { SupabaseClient } from "@supabase/supabase-js";
import type { RenameFeedItem } from "@/lib/actorRename";

export interface RenameResult { log_id: string; renamed: number; merged: number; shows: number; sessions: number }
export interface UndoResult { restored: number; split: number; skipped: number }
export interface RenameLog { id: string; created_at: string; old_name: string; new_name: string; member_count: number; show_count: number; session_count: number; undone_at: string | null }

export async function renameActor(db: SupabaseClient, oldName: string, newName: string): Promise<RenameResult> {
  const { data, error } = await db.rpc("rename_actor", { p_old: oldName, p_new: newName });
  if (error) throw new Error(error.message);
  return data as RenameResult;
}
export async function undoActorRename(db: SupabaseClient, id: string): Promise<UndoResult> {
  const { data, error } = await db.rpc("undo_actor_rename", { p_id: id });
  if (error) throw new Error(error.message);
  return data as UndoResult;
}
/** 관리자용 변경 기록. 0017을 아직 안 돌렸으면 null(안내 문구를 보여 줘요) */
export async function listRenames(db: SupabaseClient, limit = 20): Promise<RenameLog[] | null> {
  const { data, error } = await db.from("actor_renames").select("id,created_at,old_name,new_name,member_count,show_count,session_count,undone_at").order("created_at", { ascending: false }).limit(limit);
  if (error) { if (/does not exist|not find the table|schema cache/i.test(error.message)) return null; throw new Error(error.message); }
  return (data ?? []) as RenameLog[];
}
/** 손님 브라우저용: 관심 배우 이어붙이기에 필요한 열만 */
export async function fetchRenameFeed(db: SupabaseClient): Promise<RenameFeedItem[]> {
  const { data, error } = await db.from("actor_renames").select("id,created_at,old_name,new_name,undone_at").order("created_at", { ascending: true }).limit(500);
  if (error) return [];
  return (data ?? []) as RenameFeedItem[];
}
