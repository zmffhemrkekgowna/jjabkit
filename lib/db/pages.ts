import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SLUGS, isBuiltinSlug, type CustomPage, type PageSlug, type SitePage } from "@/types/page";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";
import { DbError, isMissingRelation } from "./errors";

interface Row { slug: string; title: string; body: string; updated_at: string; created_at?: string }
type Builtin = Record<PageSlug, SitePage & { custom: boolean }>;

/** 안내 페이지 표를 한 번 읽어요. 표가 아직 없는 DB(0005 전)는 빈 목록(화면은 기본 문구로 떠요), 그 밖의 오류는 숨기지 않고 올려요. created_at이 아직 없으면(0007 전) 빼고 다시 읽어요. */
async function readRows(db: SupabaseClient | null): Promise<Row[]> {
  if (!db) return [];
  let { data, error } = await db.from("site_pages").select("slug, title, body, updated_at, created_at");
  if (error && /created_at/i.test(error.message) && !isMissingRelation(error, "site_pages")) ({ data, error } = await db.from("site_pages").select("slug, title, body, updated_at"));
  if (error) {
    const e = new DbError("안내 페이지", error, "site_pages");
    if (e.missing) return [];
    throw e;
  }
  return (data ?? []) as unknown as Row[];
}

const toBuiltin = (rows: Row[]): Builtin => {
  const out = {} as Builtin;
  for (const slug of PAGE_SLUGS) {
    const r = rows.find((x) => x.slug === slug);
    out[slug] = r
      ? { slug, title: r.title, body: r.body, updatedAt: r.updated_at, custom: true }
      : { slug, title: PAGE_DEFAULTS[slug].title, body: PAGE_DEFAULTS[slug].body, updatedAt: "", custom: false };
  }
  return out;
};

const toCustom = (rows: Row[]): CustomPage[] =>
  rows.filter((r) => !isBuiltinSlug(r.slug))
    .map((r) => ({ slug: r.slug, title: r.title, body: r.body, updatedAt: r.updated_at, createdAt: r.created_at ?? r.updated_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.slug.localeCompare(b.slug)); // 추가한 순서

/** 기본 3개 페이지. DB에 문구가 없거나 표가 없으면 기본 문구를 채워요(화면이 항상 떠야 해요). */
export async function fetchPagesSafe(db: SupabaseClient | null): Promise<Builtin> {
  return toBuiltin(await readRows(db));
}

/** 기본 3개 + 관리자가 추가한 페이지를 한 번에 가져와요. (관리자 화면과 이용 안내 목록이 같은 데이터를 써요) */
export async function fetchSitePagesSafe(db: SupabaseClient | null): Promise<{ builtin: Builtin; custom: CustomPage[] }> {
  const rows = await readRows(db);
  return { builtin: toBuiltin(rows), custom: toCustom(rows) };
}

/** 추가한 페이지 하나. 없으면(삭제됐거나 주소가 틀리면) null이에요. */
export async function fetchCustomPageSafe(db: SupabaseClient | null, slug: string): Promise<CustomPage | null> {
  return (await fetchSitePagesSafe(db)).custom.find((p) => p.slug === slug) ?? null;
}

/** 새 페이지 추가. 같은 주소가 이미 있으면 덮어쓰지 않고 오류를 내요. */
export async function createPage(db: SupabaseClient, slug: string, title: string, body: string) {
  const { error } = await db.from("site_pages").insert({ slug, title: title.trim(), body: body.replace(/\r\n/g, "\n").trim() });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) throw new Error("이미 같은 주소의 안내 페이지가 있어요. 다른 주소를 입력해 주세요.");
    throw new Error(error.message);
  }
}

/** 제목·내용 저장(기본 3개와 추가한 페이지 모두). */
export async function savePage(db: SupabaseClient, slug: string, title: string, body: string) {
  const { error } = await db.from("site_pages").upsert({ slug, title: title.trim(), body: body.replace(/\r\n/g, "\n").trim() }, { onConflict: "slug" });
  if (error) throw new Error(error.message);
}

/** 기본 페이지는 저장해 둔 문구를 지워 기본 문구로 되돌리고, 추가한 페이지는 삭제돼요(같은 동작이에요). */
export async function resetPage(db: SupabaseClient, slug: string) {
  const { error } = await db.from("site_pages").delete().eq("slug", slug);
  if (error) throw new Error(error.message);
}
export const deletePage = resetPage;
