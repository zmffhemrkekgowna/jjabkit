"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { btn, inp } from "./shared";

/** 관리자 로그인 (Supabase Auth 이메일·비밀번호). 관리자로 등록된 계정이 아니면 바로 로그아웃시켜요. */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const db = createClient();
    const { error: authError } = await db.auth.signInWithPassword({ email, password });
    if (authError) {
      setBusy(false);
      return setError("이메일 또는 비밀번호를 확인해 주세요.");
    }
    const { data: isAdmin } = await db.rpc("is_admin");
    if (isAdmin !== true) {
      await db.auth.signOut();
      setBusy(false);
      return setError("관리자 계정이 아니에요.");
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-serif text-xl font-bold">관리자 로그인</h1>
      <p className="mt-1 text-xs text-mute">공연·배우·회차 데이터를 관리하는 분만 로그인할 수 있어요.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" aria-label="이메일" className={inp} />
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" aria-label="비밀번호" className={inp} />
        {error && <p role="alert" className="text-sm text-brand">{error}</p>}
        <button disabled={busy} className={`${btn} w-full justify-center`}>{busy ? "확인 중..." : "로그인"}</button>
      </form>
    </main>
  );
}
