import type { Show } from "@/types/show";

/** 배우 이름 일괄 변경의 화면 계산(미리보기)과, 각자 브라우저의 '관심 배우' 이어붙이기. DB 변경은 lib/db/actorRename.ts 가 해요. */

export interface RenamePreview {
  /** 이름이 같은 배우 줄 수(배역마다 한 줄) */
  members: number;
  /** 영향받는 회차 수(그 배우가 캐스팅된 회차) */
  sessions: number;
  shows: { id: string; title: string; start: string; end: string; roles: string[]; sessions: number }[];
  /** 같은 배역에 이미 새 이름의 배우가 있어서 합쳐지는 배역 */
  merges: { showTitle: string; role: string }[];
  /** 새 이름의 배우가 다른 배역에도 이미 있는지(이름이 같은 배우로 묶여요) */
  newExists: boolean;
}

/** 배우 이름 → 줄 수·공연 수·회차 수 (검색 목록용) */
export function actorStats(shows: Show[]): { name: string; members: number; shows: number; sessions: number }[] {
  const m = new Map<string, { members: number; shows: Set<string>; sessions: number }>();
  for (const s of shows) for (const r of s.roles) for (const a of r.actors) {
    const e = m.get(a.n) ?? { members: 0, shows: new Set<string>(), sessions: 0 };
    e.members++; e.shows.add(s.id);
    e.sessions += s.sessions.filter((x) => x.cast[r.id] === a.id).length;
    m.set(a.n, e);
  }
  return [...m].map(([name, e]) => ({ name, members: e.members, shows: e.shows.size, sessions: e.sessions })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function previewRename(shows: Show[], oldName: string, newName: string): RenamePreview {
  const o = oldName.trim(), n = newName.trim();
  const out: RenamePreview = { members: 0, sessions: 0, shows: [], merges: [], newExists: false };
  for (const s of shows) {
    const roles: string[] = []; let sess = 0;
    for (const r of s.roles) {
      const olds = r.actors.filter((a) => a.n === o);
      if (olds.length === 0) { if (n && r.actors.some((a) => a.n === n)) out.newExists = true; continue; }
      roles.push(r.name); out.members += olds.length;
      for (const a of olds) sess += s.sessions.filter((x) => x.cast[r.id] === a.id).length;
      if (n && r.actors.some((a) => a.n === n)) { out.merges.push({ showTitle: s.title, role: r.name }); out.newExists = true; }
    }
    if (roles.length) { out.shows.push({ id: s.id, title: s.title, start: s.start, end: s.end, roles, sessions: sess }); out.sessions += sess; }
  }
  return out;
}

/** 입력값 검사. 문제가 있으면 안내 문구, 괜찮으면 null */
export function renameProblem(oldName: string, newName: string, found: boolean): string | null {
  const o = oldName.trim(), n = newName.trim();
  if (!o) return "바꿀 배우의 기존 이름을 입력해 주세요.";
  if (!found) return `‘${o}’ 이름의 배우를 찾지 못했어요. 아래 목록에서 골라 보세요.`;
  if (!n) return "새 이름을 입력해 주세요.";
  if (n.length > 50) return "새 이름이 너무 길어요(50자 이하).";
  if (o === n) return "기존 이름과 새 이름이 같아요.";
  return null;
}

// ── 관심 배우 이어붙이기 ─────────────────────────────────────
export const ACTOR_RENAME_KEY = "jjabkit-actor-rename-v1";
export interface RenameFeedItem { id: string; created_at: string; old_name: string; new_name: string; undone_at: string | null }
type Applied = Record<string, "fwd" | "undone">;

/**
 * 관심 배우는 이름으로 저장돼서, 이름이 바뀌면 하트가 끊겨요. 변경 이력(오래된 순)을 보고 이 브라우저의 하트를 이어 줘요.
 * - 아직 반영 안 한 변경: 옛 이름 하트를 새 이름으로 옮겨요(새 이름이 이미 있으면 하나로).
 * - 이미 반영했는데 관리자가 되돌렸으면: 새 이름 하트를 옛 이름으로 돌려요.
 * - 이 브라우저에 그 이름의 하트가 없으면 아무것도 하지 않아요.
 */
export function migrateFavActors(actors: Set<string>, feed: RenameFeedItem[], applied: Applied): { actors: Set<string>; applied: Applied; changed: boolean } {
  const next = new Set(actors); const ap: Applied = { ...applied }; let changed = false;
  for (const r of [...feed].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const st = ap[r.id];
    if (!r.undone_at && !st) { if (next.has(r.old_name)) { next.delete(r.old_name); next.add(r.new_name); changed = true; } ap[r.id] = "fwd"; }
    else if (r.undone_at && st === "fwd") { if (next.has(r.new_name)) { next.delete(r.new_name); next.add(r.old_name); changed = true; } ap[r.id] = "undone"; }
    else if (r.undone_at && !st) ap[r.id] = "undone";
  }
  return { actors: next, applied: ap, changed: changed || JSON.stringify(ap) !== JSON.stringify(applied) };
}
export function readApplied(): Applied { try { return JSON.parse(localStorage.getItem(ACTOR_RENAME_KEY) ?? "{}") as Applied; } catch { return {}; } }
export function writeApplied(a: Applied) { try { localStorage.setItem(ACTOR_RENAME_KEY, JSON.stringify(a)); } catch { /* 저장 실패는 무시 */ } }
