import type { Show } from "@/types/show";

export interface ActorHit { name: string; role: string }
export interface SearchRow { show: Show; actors: ActorHit[]; titleHit: boolean }

/** 검색어 앞뒤 공백·대소문자는 무시해요. 공백이 섞여도 찾을 수 있게 공백 없는 형태로도 비교해요. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * 공연명·장르·배우 이름으로 찾아요. (공연장은 일부러 검색 대상이 아니에요)
 * 배우가 일치한 공연은 어느 배우가 어떤 배역인지 함께 돌려줘서, 상세 화면에 들어가지 않아도 이유를 알 수 있어요.
 */
export function searchShows(shows: Show[], q: string): SearchRow[] {
  const k = norm(q);
  if (!k) return shows.map((show) => ({ show, actors: [], titleHit: false }));
  const out: SearchRow[] = [];
  for (const show of shows) {
    const titleHit = norm(show.title).includes(k);
    const seen = new Set<string>();
    const actors: ActorHit[] = [];
    for (const r of show.roles) for (const a of r.actors) {
      const key = a.n + "\u0000" + r.name;
      if (norm(a.n).includes(k) && !seen.has(key)) { seen.add(key); actors.push({ name: a.n, role: r.name }); }
    }
    if (titleHit || show.genre.includes(q.trim()) || actors.length > 0) out.push({ show, actors, titleHit });
  }
  return out;
}

/**
 * 글자 중 검색어와 일치하는 부분을 [일치 전, 일치, 일치 후]로 나눠요.
 * 검색(searchShows)과 똑같이 공백·대소문자를 무시하고 비교해서, '홍 길동'으로 찾아도 '홍길동'이 강조돼요.
 * (비교는 공백 뺀 글자끼리 하고, 강조 범위는 원래 글자 위치로 되돌려요)
 */
export function splitHit(text: string, q: string): [string, string, string] {
  const k = norm(q);
  if (!k) return [text, "", ""];
  let flat = "";
  const pos: number[] = []; // flat의 i번째 글자가 text의 몇 번째 글자인지
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    const c = text[i].toLowerCase();
    for (const _ of c) { flat += _; pos.push(i); }
  }
  const at = flat.indexOf(k);
  if (at < 0) return [text, "", ""];
  const from = pos[at], to = pos[at + k.length - 1] + 1;
  return [text.slice(0, from), text.slice(from, to), text.slice(to)];
}

export type SortKey = "default" | "title" | "start" | "end";
export const SORTS: { v: SortKey; label: string }[] = [
  { v: "default", label: "기본순" }, { v: "title", label: "공연명순" }, { v: "start", label: "개막일순" }, { v: "end", label: "종료일순" },
];
/** 날짜가 비어 있는 공연은 임의의 날짜로 치지 않고 맨 뒤로 보내요. 같으면 원래 순서를 지켜요(안정 정렬). */
export function sortShows<T extends { show: Show }>(rows: T[], key: SortKey): T[] {
  if (key === "default") return rows;
  const idx = new Map(rows.map((r, i) => [r, i]));
  const cmp = (a: T, b: T): number => {
    if (key === "title") return a.show.title.localeCompare(b.show.title, "ko");
    const x = key === "start" ? a.show.start : a.show.end, y = key === "start" ? b.show.start : b.show.end;
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return x.localeCompare(y);
  };
  return [...rows].sort((a, b) => cmp(a, b) || (idx.get(a)! - idx.get(b)!));
}
