"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { buildFavBackup, favBackupFileName, parseFavBackup, type FavParse } from "@/lib/favBackup";
import { downloadBlob } from "@/lib/download";

type Mode = "merge" | "replace";
const card = "rounded-2xl border border-line bg-card p-4";
const btn = "inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-onbrand disabled:opacity-50";
const ghost = "inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand";

/** 데이터 백업 화면. 누구나: 내 하트(관심 공연·배우) 백업/복구. 관리자: 공연 데이터 백업 화면으로 가는 링크. */
export default function FavBackup({ shows, isAdmin }: { shows: { id: string; title: string }[]; isAdmin: boolean }) {
  const fav = useFavorites();
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Extract<FavParse, { ok: true }> | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("merge");
  const [msg, setMsg] = useState("");

  const exportJson = () => {
    const d = buildFavBackup(shows, fav.shows, fav.actors);
    downloadBlob(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), favBackupFileName());
    setMsg(`관심 공연 ${d.shows.length}개, 관심 배우 ${d.actors.length}명을 내려받았어요.`);
  };

  const pick = async (f: File | undefined) => {
    setParsed(null); setError(""); setMsg("");
    if (!f) return;
    const r = parseFavBackup(await f.text(), shows);
    if (r.ok) setParsed(r); else setError(r.error);
  };

  const apply = () => {
    if (!parsed) return;
    const s = new Set(parsed.showIds), a = new Set(parsed.actors);
    if (mode === "merge") { fav.shows.forEach((x) => s.add(x)); fav.actors.forEach((x) => a.add(x)); }
    fav.replaceAll(s, a);
    setMsg(`불러왔어요. 관심 공연 ${s.size}개, 관심 배우 ${a.size}명이에요.${parsed.unmatched.length ? ` (지금 없는 공연 ${parsed.unmatched.length}개는 건너뛰었어요)` : ""}`);
    setParsed(null);
    if (file.current) file.current.value = "";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-5">
      <header>
        <h1 className="font-serif text-xl font-bold">데이터 백업</h1>
        <p className="mt-1 text-xs text-mute">하트는 이 브라우저에만 저장돼요. 브라우저를 바꾸거나 사이트 데이터를 지우면 사라지니, 파일로 백업해 두면 안전해요.</p>
      </header>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      <section className={card}>
        <h2 className="font-bold">내 하트 백업</h2>
        <p className="mt-1 text-sm text-mute">관심 공연 {fav.shows.size}개 · 관심 배우 {fav.actors.size}명</p>
        <button onClick={exportJson} disabled={!fav.ready} className={`${btn} mt-3`}><Download size={14} aria-hidden />JSON 파일 내려받기</button>
      </section>

      <section className={card}>
        <h2 className="font-bold">내 하트 불러오기</h2>
        <p className="mt-1 text-sm text-mute">위에서 내려받은 파일만 불러올 수 있어요. 내용은 먼저 검사해요.</p>
        <input ref={file} type="file" accept="application/json,.json" aria-label="하트 백업 JSON 파일 선택" onChange={(e) => pick(e.target.files?.[0])}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-2 file:text-sm" />
        {error && <p role="alert" className="mt-3 flex items-start gap-1 rounded-xl border border-brand bg-hit p-3 text-sm"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}
        {parsed && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-line bg-bg p-3 text-sm">
              파일 안: 관심 공연 {parsed.showIds.length}개 · 관심 배우 {parsed.actors.length}명
              {parsed.unmatched.length > 0 && <p className="mt-1 text-xs text-mute">지금 없는 공연이라 건너뛰는 항목: {parsed.unmatched.slice(0, 5).join(", ")}{parsed.unmatched.length > 5 ? ` 외 ${parsed.unmatched.length - 5}개` : ""}</p>}
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-mute">불러오는 방식</legend>
              {([["merge", "지금 하트에 합치기", "지금 등록된 하트는 그대로 두고 파일의 하트를 더해요."], ["replace", "파일 내용으로 바꾸기", "지금 하트를 지우고 파일의 하트만 남겨요."]] as const).map(([v, l, h]) => (
                <label key={v} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="fav-mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
                  <span><b>{l}</b><span className="block text-xs text-mute">{h}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <button onClick={apply} className={btn}><Upload size={14} aria-hidden />불러오기</button>
              <button onClick={() => { setParsed(null); if (file.current) file.current.value = ""; }} className={ghost}>취소</button>
            </div>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className={card}>
          <h2 className="flex items-center gap-1 font-bold"><Database size={16} aria-hidden />공연 데이터 백업·복구 (관리자)</h2>
          <p className="mt-1 text-sm text-mute">등록된 전체 공연·배역·배우·회차·캐스팅을 JSON으로 저장하고 복구해요.</p>
          <Link href="/admin?tab=backup" className={`${btn} mt-3`}>관리자 백업 화면으로</Link>
        </section>
      )}
    </div>
  );
}
