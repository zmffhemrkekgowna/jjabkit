"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export const inp = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";
export const btn = "inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-onbrand disabled:opacity-50";
export const ghost = "inline-flex min-h-[44px] items-center gap-1 sm:min-h-0 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand";
export const iconBtn = "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-line p-2 text-mute hover:text-brand sm:min-h-0 sm:min-w-0";
export const PALETTES = ["#1c2b4a,#3b1d4f,#8B1E3F", "#0d1b2a,#7a1f2b,#e0a526", "#240046,#7b2cbf,#ff6ec7", "#1b1b1b,#2f3e46,#84a98c", "#2d1e12,#5c4033,#b08968"];

/** DB 작업을 실행하고, 성공하면 서버 데이터를 다시 불러와요(router.refresh). 실패하면 안내 문구를 띄워요. */
/** undo를 주면 성공 알림에 '실행 취소' 버튼이 붙어요(몇 초 동안). */
export type Run = (fn: (db: SupabaseClient) => Promise<unknown>, okMsg?: string | ((result: unknown) => string), undo?: () => Promise<unknown> | void) => Promise<boolean>;
export type Notify = (msg: string) => void;

/** 관리자 화면 공통: DB 클라이언트, 저장 실행기(run), 안내 문구(msg). */
export const TOAST_EVENT = "admin-toast";
/** 화면 아래쪽에 잠깐 떴다 사라지는 알림. 관리자 화면 어디서든 부를 수 있어요. */
export interface ToastAction { label: string; onClick: () => void | Promise<unknown> }
export const showToast = (message: string, kind: "ok" | "error" = "ok", action?: ToastAction) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, kind, action } }));
};
export const undoAction = (undo: () => Promise<unknown> | void): ToastAction => ({ label: "실행 취소", onClick: undo });

export function useAdminRun() {
  const router = useRouter();
  const db = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState("");
  const run: Run = async (fn, okMsg, undo) => {
    try { const r = await fn(db); const ok = typeof okMsg === "function" ? okMsg(r) : okMsg; setMsg(ok ?? ""); if (ok) showToast(ok, "ok", undo ? undoAction(undo) : undefined); router.refresh(); return true; }
    catch (e) { const m = friendly(e); setMsg(m); showToast(m, "error"); return false; }
  };
  return { db, run, msg, setMsg };
}

export function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Could not find the function public\.(delete_sessions|bulk_update_sessions|restore_sessions|delete_show_bundle|restore_show_bundle)|function public\.(delete_sessions|bulk_update_sessions|restore_sessions|delete_show_bundle|restore_show_bundle).* does not exist/i.test(m)) return "DB에 0008_atomic_admin_ops.sql 이 아직 적용되지 않았어요. DEPLOY.md의 순서대로 SQL을 실행해 주세요.";
  if (/sessions not found|session not found/i.test(m)) return "선택한 회차 중 이미 없어진 것이 있어요. 화면을 새로고침한 뒤 다시 시도해 주세요. (아무것도 바뀌지 않았어요)";
  if (/different show/i.test(m)) return "다른 공연의 배역은 이 회차에 연결할 수 없어요.";
  if (/duplicate key|unique/i.test(m)) return "같은 날짜·시간의 회차가 이미 있어요.";
  if (/row-level security|permission denied/i.test(m)) return "권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요.";
  if (/relation .*(events|popups).* does not exist|could not find the table .*(events|popups)/i.test(m)) return "DB에 0004_events_popups.sql 이 아직 적용되지 않았어요. DEPLOY.md를 확인해 주세요.";
  if (/schedule_color|shows_schedule_color_check/i.test(m)) return "DB에 0009_show_color.sql 이 아직 적용되지 않았어요. 스케줄 색을 저장하려면 DEPLOY.md의 순서대로 SQL을 실행해 주세요. (다른 공연 정보는 그대로 저장돼요)";
  if (/column .*color.*|could not find the .color. column/i.test(m)) return "DB에 0006_event_color.sql 이 아직 적용되지 않았어요. DEPLOY.md를 확인해 주세요.";
  if (/relation .*site_pages.* does not exist|could not find the table .*site_pages/i.test(m)) return "DB에 0005_site_pages.sql 이 아직 적용되지 않았어요. DEPLOY.md를 확인해 주세요.";
  if (/site_pages_slug_check|violates check constraint .*site_pages/i.test(m)) return "DB에 0007_site_pages_custom.sql 이 아직 적용되지 않았어요. 새 안내 페이지를 만들려면 DEPLOY.md의 순서대로 SQL을 실행해 주세요.";
  if (/relation .*notices.* does not exist|import_shows/i.test(m) && /does not exist|not find/i.test(m)) return "DB에 0003_notices_backup.sql 이 아직 적용되지 않았어요. DEPLOY.md를 확인해 주세요.";
  if (/invalid backup/i.test(m)) return `백업 내용에 문제가 있어요: ${m.replace(/^.*invalid backup: /i, "")}`;
  return m;
}

export function Sec({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export function Fld({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block text-xs font-medium text-mute ${className}`}>
      {label}<span className="mt-1 block text-ink">{children}</span>
    </label>
  );
}

/** 입력을 마치고 포커스를 벗어나거나 Enter를 눌렀을 때만 저장해요. (키를 누를 때마다 DB를 호출하지 않아요) */
export function TextInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "onKeyDown">) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input
      {...rest} value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}
