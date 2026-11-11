import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRelation } from "./errors";
import type { ImportPayload, SkippedItem } from "@/lib/scheduleImport";

export interface ImportResult {
  log_id: string; new_shows: number; existing_shows: number; new_sessions: number; existing_sessions: number;
  updated_casts: number; new_roles: number; new_actors: number; link_events: number;
  /** 0015 이후 함수만 돌려줘요(그 전에는 없어서 0으로 봐요) */
  new_events?: number; existing_events?: number;
}
export interface ImportLog {
  id: string; created_at: string; file_name: string; file_hash: string; total_rows: number; error_rows: number;
  new_shows: number; existing_shows: number; new_sessions: number; existing_sessions: number; updated_casts: number;
  new_roles: number; new_actors: number; link_events: number; update_cast: boolean; skipped: SkippedItem[];
  new_events?: number; existing_events?: number;
}
export interface ImportMeta { fileName: string; fileHash: string; totalRows: number; errorRows: number; updateCast: boolean; linkEventTitle: string }

/** 한 번의 DB 호출(= 한 트랜잭션)로 전부 등록해요. 중간에 실패하면 아무것도 등록되지 않아요. */
export async function runImport(db: SupabaseClient, payload: ImportPayload, meta: ImportMeta): Promise<ImportResult> {
  // 이벤트가 없으면 p_events를 보내지 않아서, 0015를 아직 안 돌린 DB에서도 예전처럼 일정 등록이 돼요.
  const { data, error } = await db.rpc("import_schedule", {
    p_file_name: meta.fileName, p_file_hash: meta.fileHash, p_total_rows: meta.totalRows, p_error_rows: meta.errorRows,
    p_skipped: payload.skipped.slice(0, 300), p_update_cast: meta.updateCast, p_link_event_title: meta.linkEventTitle, p_shows: payload.shows,
    ...(payload.events.length ? { p_events: payload.events } : {}),
  });
  if (error) throw new Error(error.message);
  return data as ImportResult;
}

/** 업로드 이력(최근 20건). 0014를 아직 안 돌렸으면 missing:true. */
export async function fetchImportLogs(db: SupabaseClient): Promise<{ logs: ImportLog[]; missing: boolean }> {
  const { data, error } = await db.from("schedule_imports").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) {
    if (isMissingRelation(error, "schedule_imports")) return { logs: [], missing: true };
    throw new Error(error.message);
  }
  return { logs: (data ?? []) as ImportLog[], missing: false };
}
