"use client";

import { useEffect, useState } from "react";
import { todayKST } from "./period";
import { nowKST } from "./home";

/** 다음 한국 시간 자정까지 남은 밀리초 */
export const msToKstMidnight = (now = Date.now()) => 86400e3 - ((now + 9 * 3600e3) % 86400e3);

/**
 * 한국 시간(KST) 기준 오늘 'YYYY-MM-DD'. 화면을 열어 둔 채 자정이 지나도 바뀌어요.
 * 갱신 시점: 마운트 직후 / 탭이 다시 보이거나 창이 포커스를 얻을 때 / 다음 자정(타이머 한 개, 1초마다 확인하지 않아요).
 * initial: 서버가 그린 값. 서버·브라우저 값이 달라도 첫 렌더는 initial로 맞추고 마운트 후에 바로잡아서 hydration 오류가 없어요.
 */
export function useTodayKST(initial: string = todayKST()): string {
  const [today, setToday] = useState(initial);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { setToday(todayKST()); arm(); }, msToKstMidnight() + 500); };
    const sync = () => { setToday(todayKST()); arm(); };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return today;
}

/**
 * 한국 시간(KST) 현재 시각 'YYYY-MM-DD HH:mm'. 회차가 이미 시작했는지 가를 때 써요.
 * 1분마다, 그리고 탭이 다시 보이거나 창이 포커스를 얻을 때 갱신돼요.
 */
export function useNowKST(initial: string = nowKST()): string {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const sync = () => setNow(nowKST());
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    const timer = setInterval(sync, 60e3);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return now;
}
