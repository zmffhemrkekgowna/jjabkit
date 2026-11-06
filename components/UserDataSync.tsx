"use client";

import { useEffect } from "react";
import { useFavorites } from "@/lib/favorites";
import { useMySched } from "@/lib/mySched";
import { useWatched } from "@/lib/watched";
import type { ShowRefLite } from "@/lib/relink";

/**
 * 화면에 보이지 않는 동기화 컴포넌트. 공연 데이터가 다시 만들어져 id가 바뀌었을 때,
 * 이 브라우저의 관심 공연·내 일정을 제목·날짜·시간으로 새 id에 이어 붙여요. (지우지 않아요)
 */
export default function UserDataSync({ shows }: { shows: ShowRefLite[] }) {
  const fav = useFavorites();
  const mine = useMySched();
  const { ready, reconcile: favSync } = fav;
  const { ready: mReady, reconcile: mineSync } = mine;
  useEffect(() => { if (ready) favSync(shows); }, [ready, favSync, shows]);
  useEffect(() => { if (mReady) mineSync(shows); }, [mReady, mineSync, shows]);
  // 관극 기록도 회차 id와 이어 줘요. 모호하거나 맞는 회차가 없으면 건드리지 않고 그대로 둬요.
  const { link } = useWatched();
  useEffect(() => { link(shows); }, [link, shows]);
  return null;
}
