/** 프로토타입 화면이 쓰는 모양 그대로. DB 행은 lib/db/shows.ts에서 이 모양으로 바꿔요. */
export type Genre = "뮤지컬" | "연극";
export type Status = "running" | "upcoming";

export interface CastMember { id: string; n: string }
export interface Role { id: string; name: string; short: string; actors: CastMember[] }

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  /** roleId -> castMemberId ('' 이면 미정) */
  cast: Record<string, string>;
  curtain: boolean;
  timesale: boolean;
}

export interface Show {
  id: string;
  title: string;
  genre: Genre;
  status: Status;
  start: string;
  end: string;
  venue: string;
  region: string;
  age: string;
  run: string;
  eb: string;
  grad: string;
  img: string;
  /** 기본 포스터에 얹는 글자 (공연명을 공백으로 나눔) */
  poster: string[];
  roles: Role[];
  sessions: Session[];
}

export type ShowPatch = Partial<
  Pick<Show, "title" | "genre" | "status" | "start" | "end" | "venue" | "region" | "age" | "run" | "eb" | "grad" | "img">
>;

export interface SessionInput {
  date: string;
  time: string;
  cast: Record<string, string>;
  curtain: boolean;
  timesale: boolean;
}
