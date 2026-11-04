import type { Session, Show } from "@/types/show";
import { todayKST } from "./period";

/** 캘린더(.ics) 파일 만들기. 아이폰·안드로이드·구글/네이버 캘린더에서 열면 일정과 알림이 들어가요. */
const p2 = (n: number) => String(n).padStart(2, "0");
/** RFC 5545 TEXT 값 이스케이프: 역슬래시, 세미콜론, 쉼표, 줄바꿈 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 상영 시간 글자("2시간 30분", "150분")에서 분 단위를 읽어요. 못 읽으면 150분. */
export function durationMin(run: string): number {
  const h = /(\d+)\s*시간/.exec(run), m = /(\d+)\s*분/.exec(run);
  const t = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return t > 0 && t <= 600 ? t : 150;
}

const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
function endOf(date: string, time: string, min: number): string {
  const [y, mo, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const e = new Date(Date.UTC(y, mo - 1, d, h, mi + min));
  return `${e.getUTCFullYear()}${p2(e.getUTCMonth() + 1)}${p2(e.getUTCDate())}T${p2(e.getUTCHours())}${p2(e.getUTCMinutes())}00`;
}

/** RFC 5545: 한 줄은 75바이트까지, 넘기면 줄을 바꾸고 공백으로 이어요. (글자 중간에서 끊지 않아요) */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length === 0 ? 75 : 74)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** hit: 관심 배우 일정처럼 어떤 배우 때문에 담긴 회차인지 알려줄 때만 넣어요. 없으면 예전과 똑같이 만들어요. */
export interface IcsItem { show: Show; session: Session; hit?: string[] }

export function castNames(show: Show, s: Session): string[] {
  const byId = new Map(show.roles.flatMap((r) => r.actors.map((a) => [a.id, a.n] as const)));
  return show.roles.map((r) => byId.get(s.cast[r.id])).filter((n): n is string => !!n);
}

export function buildIcs(items: IcsItem[], now = new Date(), calName = "JJabKit 내 일정"): string {
  const dtstamp = `${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}T${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}${p2(now.getUTCSeconds())}Z`;
  const L: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JJabKit//My Schedule//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`, "X-WR-TIMEZONE:Asia/Seoul",
    "BEGIN:VTIMEZONE", "TZID:Asia/Seoul", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:KST", "END:STANDARD", "END:VTIMEZONE",
  ];
  const seen = new Set<string>();
  for (const { show, session: s, hit } of items) {
    if (seen.has(s.id)) continue; // 같은 회차는 한 번만
    seen.add(s.id);
    const cast = castNames(show, s), tags = [s.curtain ? "커튼콜 데이" : ""].filter(Boolean);
    const desc = [hit?.length ? `관심 배우: ${hit.join(", ")}` : "", cast.length ? `출연: ${cast.join(", ")}` : "출연진 미정", tags.join(" · "), "예매 전 공식 예매처에서 정보를 다시 확인하세요."].filter(Boolean).join("\n");
    L.push(
      "BEGIN:VEVENT", `UID:${s.id}@jjabkit`, `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Seoul:${stamp(s.date, s.time)}`, `DTEND;TZID=Asia/Seoul:${endOf(s.date, s.time, durationMin(show.run))}`,
      `SUMMARY:${esc(hit?.length ? `${show.title} - ${hit.join(", ")}` : show.title)}`, ...(show.venue ? [`LOCATION:${esc(show.venue)}`] : []), `DESCRIPTION:${esc(desc)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`내일 관람: ${show.title}`)}`, "TRIGGER:-P1D", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`곧 시작: ${show.title}`)}`, "TRIGGER:-PT2H", "END:VALARM",
      "END:VEVENT",
    );
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

export const icsFileName = (now = new Date()) => `jjabkit-my-schedule-${todayKST(now.getTime()).replace(/-/g, "")}.ics`;
export const icsOneFileName = (show: Pick<Show, "title">, s: Pick<Session, "date">) => `${show.title.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40)}-${s.date.replace(/-/g, "")}.ics`;

const safe = (t: string) => t.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30);
/** 관심 배우 일정 파일 이름: 배우가 한 명이면 이름, 여러 명이면 '이름 외 N명' */
export const icsActorsFileName = (names: string[], now = new Date()) =>
  `jjabkit-${names.length === 0 ? "관심배우" : names.length === 1 ? safe(names[0]) : `${safe(names[0])}_외${names.length - 1}명`}-${todayKST(now.getTime()).replace(/-/g, "")}.ics`;
