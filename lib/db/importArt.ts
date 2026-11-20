import type { SupabaseClient } from "@supabase/supabase-js";
import { updateShow, uploadPoster } from "./shows";

/** 등록 버튼을 누르기 전까지는 이 기기에만 담아 두는 '예약' 값이에요. DB에는 '일괄 등록'을 눌러야 반영돼요. */
export interface ArtDraft {
  file?: File;            // 새로 올릴(또는 교체할) 포스터 파일
  url?: string;           // 이미지 주소로 등록할 포스터(검사를 통과한 http(s) 주소). file과 동시에 두지 않아요 — 나중에 고른 쪽만 남겨요.
  removePoster?: boolean; // 기존 포스터를 지울지
  color?: string;         // "#rrggbb" = 이 색으로, "" = 자동 배정 색으로 되돌리기, undefined = 바꾸지 않음
}
/** 바뀌는 항목 수(포스터 1 + 색 1). 0이면 이 공연의 기존 포스터·색은 건드리지 않아요. */
export const artChanges = (d?: ArtDraft) => (d ? (d.file || d.url || d.removePoster ? 1 : 0) + (d.color !== undefined ? 1 : 0) : 0);

export interface ArtItem { title: string; showId: string | null; draft: ArtDraft }
export interface ArtReport { title: string; poster: "none" | "uploaded" | "linked" | "removed" | "failed"; color: "none" | "set" | "reset" | "failed"; error?: string }

/** 방금 등록한 새 공연을 제목으로 찾아요(가장 최근에 만든 것). 새 공연은 같은 이름의 기존 공연이 없을 때만 만들어지므로 보통 하나예요. */
export async function findShowIdByTitle(db: SupabaseClient, title: string): Promise<string | null> {
  const { data, error } = await db.from("shows").select("id").eq("title", title).order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const row = (data as { id: string }[] | null)?.[0];
  return row?.id ?? null;
}

/**
 * 예약해 둔 포스터·색을 공연에 저장해요. 예약이 없는 공연(draft가 비어 있는 공연)은 아예 건드리지 않아요.
 * 한 공연이 실패해도 다른 공연은 계속 처리하고, 결과를 공연별로 돌려줘요. 포스터 업로드가 실패해도 색은 따로 저장해요.
 */
export async function applyArt(db: SupabaseClient, items: ArtItem[]): Promise<ArtReport[]> {
  const out: ArtReport[] = [];
  for (const it of items) {
    if (!artChanges(it.draft)) continue;
    const rep: ArtReport = { title: it.title, poster: "none", color: "none" };
    try {
      const id = it.showId ?? (await findShowIdByTitle(db, it.title));
      if (!id) { rep.poster = it.draft.file || it.draft.url || it.draft.removePoster ? "failed" : "none"; rep.color = it.draft.color !== undefined ? "failed" : "none"; rep.error = "등록된 공연을 찾지 못했어요(오류로 제외된 공연일 수 있어요)."; out.push(rep); continue; }
      const patch: { img?: string; color?: string } = {};
      if (it.draft.file) {
        try { patch.img = await uploadPoster(db, id, it.draft.file); rep.poster = "uploaded"; }
        catch (e) { rep.poster = "failed"; rep.error = e instanceof Error ? e.message : String(e); }
      } else if (it.draft.url) { patch.img = it.draft.url; rep.poster = "linked"; } // 이미지 주소는 업로드 없이 포스터 주소로 바로 저장(관리자 '공연 수정'의 포스터 URL과 같은 칸)
      else if (it.draft.removePoster) { patch.img = ""; rep.poster = "removed"; }
      if (it.draft.color !== undefined) { patch.color = it.draft.color; rep.color = it.draft.color ? "set" : "reset"; }
      if (Object.keys(patch).length) {
        try { await updateShow(db, id, patch); }
        catch (e) { rep.error = e instanceof Error ? e.message : String(e); if (patch.img !== undefined) rep.poster = "failed"; if (patch.color !== undefined) rep.color = "failed"; }
      }
    } catch (e) {
      rep.error = e instanceof Error ? e.message : String(e);
      if (it.draft.file || it.draft.url || it.draft.removePoster) rep.poster = "failed";
      if (it.draft.color !== undefined) rep.color = "failed";
    }
    out.push(rep);
  }
  return out;
}
