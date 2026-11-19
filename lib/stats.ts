import { GENRES, type WatchedRecord } from "./watched";

export interface Count { label: string; count: number }
export interface Stats {
  total: number;
  years: string[]; // 기록이 있는 해(최신순)
  /** 선택한 해의 월별 관극 횟수(1~12월, 0도 포함) */
  monthly: number[];
  yearTotals: Count[]; // 연도별 누적(오름차순)
  cumulative: number[]; // 선택한 해 안에서 월별 누적
  byShow: Count[];
  byActor: Count[];
  /** 장르별 관극 횟수. 뮤지컬·연극·콘서트는 0이어도 항상 있고, 장르를 알 수 없는 기록은 '미분류'로(있을 때만) 마지막에 나와요. 합계는 total과 같아요. */
  byGenre: Count[];
}
const desc = (a: Count, b: Count) => b.count - a.count || a.label.localeCompare(b.label, "ko");

/** 관극 완료로 표시된 기록만으로 계산해요. year가 '전체'면 모든 해를 합쳐 공연·배우를 세요. */
export const UNCLASSIFIED = "미분류";
/**
 * 기록의 장르: 공연이 지금도 있으면 그 공연의 현재 장르, 없으면(삭제됨) 기록에 적힌 장르, 둘 다 없으면 '미분류'.
 * genreByShowId는 지금 있는 공연의 id → 장르예요(없으면 기록에 적힌 값만 봐요).
 */
export const genreOfRecord = (r: WatchedRecord, genreByShowId?: Map<string, string>): string => {
  const live = r.showId ? genreByShowId?.get(r.showId) : undefined;
  const g = live ?? r.genre;
  return g && (GENRES as readonly string[]).includes(g) ? g : UNCLASSIFIED;
};

export function computeStats(records: WatchedRecord[], year: string | "all", genreByShowId?: Map<string, string>): Stats {
  const years = [...new Set(records.map((r) => r.date.slice(0, 4)))].sort().reverse();
  const inYear = year === "all" ? records : records.filter((r) => r.date.startsWith(year));
  const monthly = Array<number>(12).fill(0);
  for (const r of inYear) monthly[Number(r.date.slice(5, 7)) - 1]++;
  let run = 0;
  const cumulative = monthly.map((n) => (run += n));
  const gn = new Map<string, number>(GENRES.map((g) => [g, 0]));
  const ym = new Map<string, number>(), sh = new Map<string, number>(), ac = new Map<string, number>();
  for (const r of records) ym.set(r.date.slice(0, 4), (ym.get(r.date.slice(0, 4)) ?? 0) + 1);
  for (const r of inYear) {
    sh.set(r.show, (sh.get(r.show) ?? 0) + 1);
    { const g = genreOfRecord(r, genreByShowId); gn.set(g, (gn.get(g) ?? 0) + 1); }
    for (const a of new Set(r.actors)) ac.set(a, (ac.get(a) ?? 0) + 1); // 한 회차에 같은 배우는 1번만
  }
  const toList = (m: Map<string, number>): Count[] => [...m].map(([label, count]) => ({ label, count })).sort(desc);
  return {
    total: inYear.length, years, monthly, cumulative,
    yearTotals: [...ym].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    byShow: toList(sh), byActor: toList(ac),
    byGenre: [...gn].filter(([g, n]) => g !== UNCLASSIFIED || n > 0).map(([label, count]) => ({ label, count })),
  };
}
