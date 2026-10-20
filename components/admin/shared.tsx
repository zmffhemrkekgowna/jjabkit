"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export const inp = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";
export const btn = "inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-onbrand disabled:opacity-50";
export const ghost = "inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand";
export const iconBtn = "shrink-0 rounded-lg border border-line p-2 text-mute hover:text-brand";
export const PALETTES = ["#1c2b4a,#3b1d4f,#8B1E3F", "#0d1b2a,#7a1f2b,#e0a526", "#240046,#7b2cbf,#ff6ec7", "#1b1b1b,#2f3e46,#84a98c", "#2d1e12,#5c4033,#b08968"];

/** DB 작업을 실행하고, 성공하면 서버 데이터를 다시 불러와요(router.refresh). 실패하면 안내 문구를 띄워요. */
export type Run = (fn: (db: SupabaseClient) => Promise<unknown>, okMsg?: string) => Promise<boolean>;
export type Notify = (msg: string) => void;

/** 관리자 화면 공통: DB 클라이언트, 저장 실행기(run), 안내 문구(msg). */
export function useAdminRun() {
  const router = useRouter();
  const db = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState("");
  const run: Run = async (fn, okMsg) => {
    try { await fn(db); setMsg(okMsg ?? ""); router.refresh(); return true; }
    catch (e) { setMsg(friendly(e)); return false; }
  };
  return { db, run, msg, setMsg };
}

export function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/duplicate key|unique/i.test(m)) return "같은 날짜·시간의 회차가 이미 있어요.";
  if (/row-level security|permission denied/i.test(m)) return "권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요.";
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
