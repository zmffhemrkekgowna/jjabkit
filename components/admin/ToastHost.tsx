"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { TOAST_EVENT, type ToastAction } from "./shared";

interface Toast { id: number; message: string; kind: "ok" | "error"; action?: ToastAction }

/** 관리자 화면 공통 알림창. 성공은 3.5초, 오류는 7초 뒤에 사라져요. 눌러서 바로 닫을 수도 있어요. */
export default function ToastHost() {
  const [t, setT] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; kind: "ok" | "error"; action?: ToastAction }>).detail;
      if (timer.current) clearTimeout(timer.current);
      const id = ++n;
      setT({ id, message: d.message, kind: d.kind, action: d.action });
      // 실행 취소 버튼이 있으면 눌러 볼 시간을 넉넉히(10초) 줘요
      timer.current = setTimeout(() => setT((cur) => (cur && cur.id === id ? null : cur)), d.action ? 10000 : d.kind === "error" ? 7000 : 3500);
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => { window.removeEventListener(TOAST_EVENT, on); if (timer.current) clearTimeout(timer.current); };
  }, []);
  if (!t) return null;
  const err = t.kind === "error";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div role={err ? "alert" : "status"} aria-live={err ? "assertive" : "polite"}
        className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl ${err ? "bg-red-600 text-white" : "bg-ink text-bg"}`}>
        {err ? <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />}
        <span className="min-w-0 flex-1 break-words">{t.message}</span>
        {t.action && <button onClick={() => { const a = t.action; setT(null); void a?.onClick(); }} className="shrink-0 rounded-lg bg-bg px-2.5 py-1 text-xs font-bold text-ink underline-offset-2 hover:underline">{t.action.label}</button>}
        <button onClick={() => setT(null)} aria-label="알림 닫기" className="shrink-0 opacity-80 hover:opacity-100"><X size={16} aria-hidden /></button>
      </div>
    </div>
  );
}
