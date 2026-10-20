"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import type { Show } from "@/types/show";
import { BACKUP_VERSION, MAX_FILE_BYTES, backupFileName, buildBackup, countSessions, parseBackup, type BackupShow } from "@/lib/backup";
import { downloadBlob } from "@/lib/download";
import { Sec, btn, ghost, useAdminRun } from "./shared";

type Mode = "add" | "skip" | "replace";

/** 전체 공연·배역·배우·회차·캐스팅을 JSON 파일로 내려받고, 같은 형식의 파일로 한 번에 복구해요. */
export default function BackupPanel({ shows }: { shows: Show[] }) {
  const { run, msg, setMsg } = useAdminRun();
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ name: string; shows: BackupShow[]; exportedAt: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("skip");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportJson = () => {
    const data = buildBackup(shows);
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), backupFileName());
    setMsg(`공연 ${data.shows.length}개를 내려받았어요. 포스터 이미지는 파일이 아니라 주소만 담겨요.`);
  };

  const pickFile = async (f: File | undefined) => {
    setParsed(null); setErrors([]); setConfirm(false); setMsg("");
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setErrors(["파일이 너무 커요. (5MB 이하만 불러올 수 있어요)"]); return; }
    const r = parseBackup(await f.text());
    if (r.ok) setParsed({ name: f.name, shows: r.shows, exportedAt: r.exportedAt });
    else setErrors(r.errors);
  };

  const existing = new Set(shows.map((s) => s.title));
  const toImport = parsed ? (mode === "skip" ? parsed.shows.filter((s) => !existing.has(s.title)) : parsed.shows) : [];
  const skipped = parsed ? parsed.shows.length - toImport.length : 0;
  const canImport = !!parsed && !busy && (mode !== "replace" || confirm) && (toImport.length > 0 || mode === "replace");

  const doImport = async () => {
    if (!parsed) return;
    setBusy(true);
    const ok = await run(async (db) => {
      const { error } = await db.rpc("import_shows", { p_data: { shows: toImport }, p_replace: mode === "replace" });
      if (error) throw new Error(error.message);
    }, `공연 ${toImport.length}개를 불러왔어요.${skipped ? ` (이미 있는 ${skipped}개는 건너뛰었어요)` : ""}`);
    // 실패하면 DB는 그대로예요(한 번에 전부 성공하거나 전부 취소돼요). 파일 선택은 남겨 두어 다시 시도할 수 있어요.
    setBusy(false);
    if (ok) { if (file.current) file.current.value = ""; setParsed(null); setConfirm(false); }
  };

  const radio = (v: Mode, label: string, hint: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="radio" name="import-mode" checked={mode === v} onChange={() => { setMode(v); setConfirm(false); }} className="mt-1" />
      <span><b>{label}</b><span className="block text-xs text-mute">{hint}</span></span>
    </label>
  );

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      <Sec title="백업 내려받기 (JSON)">
        <p className="text-sm text-mute">지금 등록된 공연 {shows.length}개의 정보, 배역, 배우, 회차, 회차별 캐스팅을 파일 하나로 저장해요. 소식(공지)과 포스터 이미지 파일은 포함되지 않아요.</p>
        <button onClick={exportJson} className={`${btn} mt-3`}><Download size={14} aria-hidden />JSON 파일 내려받기</button>
      </Sec>

      <Sec title="백업 불러오기 (JSON)">
        <p className="text-sm text-mute">JJabKit에서 내려받은 JSON 파일(버전 {BACKUP_VERSION})만 불러올 수 있어요. 파일 내용은 먼저 검사하고, 문제가 있으면 아무것도 바꾸지 않아요.</p>
        <input ref={file} type="file" accept="application/json,.json" aria-label="백업 JSON 파일 선택" onChange={(e) => pickFile(e.target.files?.[0])}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-2 file:text-sm" />

        {errors.length > 0 && (
          <div role="alert" className="mt-3 rounded-xl border border-brand bg-hit p-3 text-sm">
            <b className="flex items-center gap-1"><AlertTriangle size={14} aria-hidden />이 파일은 불러올 수 없어요</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {parsed && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-line bg-bg p-3 text-sm">
              <b>{parsed.name}</b>
              <div className="mt-1 text-mute">공연 {parsed.shows.length}개 · 회차 {countSessions(parsed.shows)}개{parsed.exportedAt ? ` · 내보낸 시각 ${parsed.exportedAt.slice(0, 16).replace("T", " ")}` : ""}</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-mute">
                {parsed.shows.slice(0, 8).map((s, i) => <li key={i}>{s.title}{existing.has(s.title) ? " (이미 있는 제목)" : ""}</li>)}
                {parsed.shows.length > 8 && <li>…외 {parsed.shows.length - 8}개</li>}
              </ul>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-mute">불러오는 방식</legend>
              {radio("skip", "새 공연만 추가", "지금 있는 공연과 제목이 같으면 건너뛰어요.")}
              {radio("add", "모두 추가", "제목이 같아도 새 공연으로 추가해요. (중복될 수 있어요)")}
              {radio("replace", "전체 교체 (복구)", "지금 등록된 공연을 모두 지우고 파일 내용으로 바꿔요.")}
            </fieldset>

            {mode === "replace" && (
              <label className="flex items-start gap-2 rounded-xl border border-brand bg-hit p-3 text-sm">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>지금 등록된 공연 {shows.length}개와 그 회차가 모두 삭제되는 것을 확인했어요. 먼저 위에서 백업을 내려받았어요.</span>
              </label>
            )}
            {mode === "skip" && skipped > 0 && <p className="text-xs text-mute">제목이 겹치는 {skipped}개는 건너뛰고 {toImport.length}개를 추가해요.</p>}

            <div className="flex gap-2">
              <button onClick={doImport} disabled={!canImport} className={btn}><Upload size={14} aria-hidden />{busy ? "불러오는 중…" : "불러오기"}</button>
              <button onClick={() => { setParsed(null); setConfirm(false); if (file.current) file.current.value = ""; }} className={ghost}>취소</button>
            </div>
          </div>
        )}
      </Sec>
    </div>
  );
}
