/** 기본 안내 페이지 3개(없애지 않고, 문구만 고쳐요). 주소도 그대로(/about, /privacy, /contact)예요. */
export type PageSlug = "about" | "privacy" | "contact";
export const PAGE_SLUGS: PageSlug[] = ["about", "privacy", "contact"];
export interface SitePage { slug: PageSlug; title: string; body: string; updatedAt: string }

/** 관리자가 직접 추가한 안내 페이지. 주소는 /guide/<slug> 예요. */
export interface CustomPage { slug: string; title: string; body: string; updatedAt: string; createdAt: string }
/** 주소(slug) 규칙: 영문 소문자·숫자·하이픈, 1~40자, 하이픈으로 시작하지 않아요. (DB 제약과 같아요) */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** 이미 쓰는 주소라 새 페이지 주소로는 쓸 수 없어요. */
export const RESERVED_SLUGS: string[] = [...PAGE_SLUGS, "new"];
export const isBuiltinSlug = (s: string): s is PageSlug => (PAGE_SLUGS as string[]).includes(s);
