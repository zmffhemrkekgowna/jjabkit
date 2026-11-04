/** PostgREST/Postgres 오류에서 "표(또는 칸)가 아직 없다"를 알아내요. 마이그레이션을 아직 안 돌린 DB를 다른 오류와 구분하기 위해서예요. */
export interface DbErrorLike { code?: string; message?: string }
export function isMissingRelation(e: DbErrorLike | null | undefined, table?: string): boolean {
  if (!e) return false;
  const m = e.message ?? "";
  // 42P01: undefined_table(Postgres) / PGRST205: 스키마 캐시에 표 없음(PostgREST)
  if (e.code === "42P01" || e.code === "PGRST205") return !table || m.includes(table) || m === "";
  return new RegExp(`relation .*${table ?? ""}.* does not exist|could not find the table .*${table ?? ""}`, "i").test(m);
}

/** 조회 실패. 사용자에게는 고정된 쉬운 문구만 보여 주고, 원본(코드·메시지)은 서버 로그에만 남겨요. */
export class DbError extends Error {
  readonly missing: boolean;
  constructor(readonly label: string, original: DbErrorLike, table?: string) {
    super(`${label}을(를) 불러오지 못했어요.`);
    this.name = "DbError";
    this.missing = isMissingRelation(original, table);
    if (!this.missing) console.error(`[db] ${label} 조회 실패`, original.code ?? "", original.message ?? "");
  }
}
