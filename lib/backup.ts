import type { Genre, Show, Status } from "@/types/show";

/**
 * 관리자 데이터 백업(JSON) 형식과 검증.
 * 화면용 id(uuid)는 담지 않고, 배역·배우를 "이름"으로 이어요. 그래서 다른 DB로 옮겨도 그대로 복구돼요.
 * 포스터 이미지는 파일이 아니라 주소(URL)만 담겨요.
 */
export const BACKUP_APP = "myukit";
export const BACKUP_VERSION = 1;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LIMITS = { shows: 200, roles: 20, actors: 50, sessions: 2000, text: 200, url: 2000 } as const;

export interface BackupSession { date: string; time: string; curtain: boolean; timesale: boolean; cast: Record<string, string> }
export interface BackupRole { name: string; short: string; actors: string[] }
export interface BackupShow {
  title: string; genre: Genre; status: Status; start: string; end: string; venue: string; region: string;
  age: string; run: string; eb: string; grad: string; img: string; roles: BackupRole[]; sessions: BackupSession[];
}
export interface BackupFile { app: typeof BACKUP_APP; version: number; exportedAt: string; shows: BackupShow[] }

/* ───────── 내보내기 ───────── */
export function buildBackup(shows: Show[], now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    shows: shows.map((s) => {
      const actorName = new Map<string, string>();
      s.roles.forEach((r) => r.actors.forEach((a) => actorName.set(a.id, a.n)));
      return {
        title: s.title, genre: s.genre, status: s.status, start: s.start, end: s.end, venue: s.venue, region: s.region,
        age: s.age, run: s.run, eb: s.eb, grad: s.grad, img: s.img,
        roles: s.roles.map((r) => ({ name: r.name, short: r.short, actors: r.actors.map((a) => a.n) })),
        sessions: [...s.sessions]
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
          .map((x) => ({
            date: x.date, time: x.time, curtain: x.curtain, timesale: x.timesale,
            cast: Object.fromEntries(s.roles.map((r) => [r.name, actorName.get(x.cast[r.id]) ?? ""])),
          })),
      };
    }),
  };
}

export const backupFileName = (now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `myukit-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
};

/* ───────── 불러오기 검증 ───────── */
export type ParseResult = { ok: true; shows: BackupShow[]; exportedAt: string } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PALETTE = /^#[0-9a-fA-F]{3,8},#[0-9a-fA-F]{3,8},#[0-9a-fA-F]{3,8}$/;
const DEFAULT_GRAD = "#1c2b4a,#3b1d4f,#8B1E3F";

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** 외부에서 온 JSON 글자를 검사하고 안전한 모양으로 다시 만들어요. 문제가 있으면 어디가 문제인지 모두 모아서 알려줘요. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, errors: ["파일이 너무 커요. (5MB 이하만 불러올 수 있어요)"] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["JSON 형식이 아니에요. 뮤킷에서 내보낸 파일이 맞는지 확인해 주세요."] }; }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, errors: ["뮤킷 백업 파일이 아니에요."] };
  if (raw.version !== BACKUP_VERSION) return { ok: false, errors: [`지원하지 않는 버전이에요. (파일 버전: ${String(raw.version)}, 지원: ${BACKUP_VERSION})`] };
  if (!Array.isArray(raw.shows)) return { ok: false, errors: ["공연 목록(shows)이 없어요."] };
  if (raw.shows.length > LIMITS.shows) return { ok: false, errors: [`공연은 한 번에 ${LIMITS.shows}개까지 불러올 수 있어요.`] };

  const errors: string[] = [];
  const err = (where: string, msg: string) => { if (errors.length < 30) errors.push(`${where}: ${msg}`); };
  const str = (v: unknown, where: string, field: string, opt: { required?: boolean; max?: number } = {}): string => {
    if (v === undefined || v === null) { if (opt.required) err(where, `${field}이(가) 없어요.`); return ""; }
    if (typeof v !== "string") { err(where, `${field}은(는) 글자여야 해요.`); return ""; }
    const t = v.trim();
    if (opt.required && !t) err(where, `${field}이(가) 비어 있어요.`);
    if (t.length > (opt.max ?? LIMITS.text)) { err(where, `${field}이(가) 너무 길어요.`); return ""; }
    return t;
  };

  const shows: BackupShow[] = [];
  raw.shows.forEach((rs, i) => {
    const w = `공연 ${i + 1}`;
    if (!isObj(rs)) { err(w, "올바른 형식이 아니에요."); return; }
    const title = str(rs.title, w, "제목", { required: true, max: 100 });
    const where = title ? `${w} '${title}'` : w;

    const genre = rs.genre === undefined ? "뮤지컬" : rs.genre;
    if (genre !== "뮤지컬" && genre !== "연극") err(where, "장르는 '뮤지컬' 또는 '연극'이어야 해요.");
    const status = rs.status === undefined ? "upcoming" : rs.status;
    if (status !== "running" && status !== "upcoming") err(where, "상태는 'running' 또는 'upcoming'이어야 해요.");
    const start = str(rs.start, where, "시작일"), end = str(rs.end, where, "종료일");
    if (start && !validDate(start)) err(where, `시작일 형식이 잘못됐어요: ${start}`);
    if (end && !validDate(end)) err(where, `종료일 형식이 잘못됐어요: ${end}`);
    const img = str(rs.img, where, "포스터 주소", { max: LIMITS.url });
    if (img && !/^https?:\/\//i.test(img)) err(where, "포스터 주소는 http:// 또는 https:// 로 시작해야 해요.");
    let grad = str(rs.grad, where, "포스터 색", { max: 100 });
    if (grad && !PALETTE.test(grad)) { err(where, "포스터 색 형식이 잘못됐어요."); grad = ""; }

    const roles: BackupRole[] = [];
    const actorsByRole = new Map<string, Set<string>>();
    const rolesRaw = rs.roles === undefined ? [] : rs.roles;
    if (!Array.isArray(rolesRaw)) err(where, "배역 목록(roles)이 배열이 아니에요.");
    else {
      if (rolesRaw.length > LIMITS.roles) err(where, `배역은 ${LIMITS.roles}개까지예요.`);
      rolesRaw.forEach((rr, j) => {
        const rw = `${where} 배역 ${j + 1}`;
        if (!isObj(rr)) { err(rw, "올바른 형식이 아니에요."); return; }
        const name = str(rr.name, rw, "배역 이름", { required: true, max: 50 });
        const short = str(rr.short, rw, "짧은 이름", { max: 50 }) || name;
        if (name && roles.some((x) => x.name === name)) err(rw, `배역 이름이 겹쳐요: ${name}`);
        const actors: string[] = [];
        const ar = rr.actors === undefined ? [] : rr.actors;
        if (!Array.isArray(ar)) err(rw, "배우 목록(actors)이 배열이 아니에요.");
        else {
          if (ar.length > LIMITS.actors) err(rw, `배우는 배역당 ${LIMITS.actors}명까지예요.`);
          ar.forEach((a) => {
            const n = str(a, rw, "배우 이름", { required: true, max: 50 });
            if (n && actors.includes(n)) err(rw, `같은 배역에 배우 이름이 겹쳐요: ${n}`);
            else if (n) actors.push(n);
          });
        }
        roles.push({ name, short, actors });
        actorsByRole.set(name, new Set(actors));
      });
    }

    const sessions: BackupSession[] = [];
    const seen = new Set<string>();
    const sr = rs.sessions === undefined ? [] : rs.sessions;
    if (!Array.isArray(sr)) err(where, "회차 목록(sessions)이 배열이 아니에요.");
    else {
      if (sr.length > LIMITS.sessions) err(where, `회차는 공연당 ${LIMITS.sessions}개까지예요.`);
      sr.forEach((ss, j) => {
        const sw = `${where} 회차 ${j + 1}`;
        if (!isObj(ss)) { err(sw, "올바른 형식이 아니에요."); return; }
        const date = str(ss.date, sw, "날짜", { required: true }), time = str(ss.time, sw, "시간", { required: true });
        if (date && !validDate(date)) err(sw, `날짜 형식이 잘못됐어요: ${date}`);
        if (time && !TIME.test(time)) err(sw, `시간 형식이 잘못됐어요(HH:mm): ${time}`);
        if (date && time) { const k = `${date} ${time}`; if (seen.has(k)) err(sw, `같은 날짜·시간의 회차가 겹쳐요: ${k}`); seen.add(k); }
        for (const f of ["curtain", "timesale"] as const) if (ss[f] !== undefined && typeof ss[f] !== "boolean") err(sw, `${f}은(는) true/false여야 해요.`);
        const cast: Record<string, string> = {};
        if (ss.cast !== undefined && !isObj(ss.cast)) err(sw, "출연진(cast) 형식이 잘못됐어요.");
        else if (isObj(ss.cast)) {
          for (const [role, actor] of Object.entries(ss.cast)) {
            if (typeof actor !== "string") { err(sw, `'${role}' 배역의 배우는 글자여야 해요.`); continue; }
            const set = actorsByRole.get(role);
            if (!set) { err(sw, `없는 배역이에요: ${role}`); continue; }
            if (actor !== "" && !set.has(actor)) { err(sw, `'${role}' 배역에 없는 배우예요: ${actor}`); continue; }
            cast[role] = actor;
          }
        }
        sessions.push({ date, time, curtain: ss.curtain === true, timesale: ss.timesale === true, cast });
      });
    }

    shows.push({
      title, genre: genre as Genre, status: status as Status, start, end,
      venue: str(rs.venue, where, "극장"), region: str(rs.region, where, "지역") || "서울",
      age: str(rs.age, where, "관람 등급"), run: str(rs.run, where, "러닝타임"), eb: str(rs.eb, where, "얼리버드 안내", { max: 500 }),
      grad: grad || DEFAULT_GRAD, img, roles, sessions,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, shows, exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "" };
}

export const countSessions = (shows: BackupShow[]) => shows.reduce((n, s) => n + s.sessions.length, 0);
