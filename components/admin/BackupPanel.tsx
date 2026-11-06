"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import type { Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { BACKUP_VERSION, MAX_FILE_BYTES, backupFileName, buildBackup, countSessions, parseBackup, type BackupShow } from "@/lib/backup";
import { downloadBlob } from "@/lib/download";
import { Sec, btn, ghost, useAdminRun } from "./shared";

type Mode = "add" | "skip" | "replace";

/** 전체 공연·배역·배우·회차·캐스팅을 JSON 파일로 내려받고, 같은 형식의 파일로 한 번에 복구해요. */
export default function BackupPanel({ shows, events = [] }: { shows: Show[]; events?: EventItem[] }) {
  const { db, run, msg, setMsg } = useAdminRun();
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ name: string; shows: BackupShow[]; exportedAt: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("skip");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // 전체 교체 전에 지금 상태를 파일로 받고(1단계), 저장된 것을 직접 확인해야(2단계) 풀려요.
  const [pre, setPre] = useState<{ name: string; sig: string } | null>(null);
  const [preSaved, setPreSaved] = useState(false);
  const sigNow = `${shows.length}:${shows.reduce((n, x) => n + x.sessions.length, 0)}:${events.length}`;
  const preOk = !!pre && pre.sig === sigNow && preSaved; // 그사이 데이터가 바뀌었으면 다시 받아야 해요

  const exportJson = () => {
    const data = buildBackup(shows);
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), backupFileName());
    setMsg(`공연 ${data.shows.length}개를 내려받았어요. 포스터 이미지는 파일이 아니라 주소만 담겨요.`);
  };

  const pickFile = async (f: File | undefined) => {
    setParsed(null); setErrors([]); setConfirm(false); setMsg(""); setPre(null); setPreSaved(false);
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setErrors(["파일이 너무 커요. (5MB 이하만 불러올 수 있어요)"]); return; }
    const r = parseBackup(await f.text());
    if (r.ok) setParsed({ name: f.name, shows: r.shows, exportedAt: r.exportedAt });
    else setErrors(r.errors);
  };

  const existing = new Set(shows.map((s) => s.title));
  const toImport = parsed ? (mode === "skip" ? parsed.shows.filter((s) => !existing.has(s.title)) : parsed.shows) : [];
  const skipped = parsed ? parsed.shows.length - toImport.length : 0;
  const canImport = !!parsed && !busy && (mode !== "replace" || (confirm && preOk)) && (toImport.length > 0 || mode === "replace");

  /** 전체 교체 1단계. 만든 파일을 다시 읽어 검증하고, 통과해야만 내려받아요. 실패하면 교체는 잠긴 채예요. */
  const backupFirst = () => {
    setPre(null); setPreSaved(false);
    try {
      const titleOf = new Map(shows.map((x) => [x.id, x.title]));
      const data = {
        ...buildBackup(shows),
        // 이 앱의 불러오기는 shows만 읽어요. 이벤트는 사람이 다시 입력할 수 있게 참고용으로 함께 담아요.
        events: events.map((e) => ({ id: e.id, show: titleOf.get(e.showId) ?? "", title: e.title, startsOn: e.startsOn, endsOn: e.endsOn, linkUrl: e.linkUrl, color: e.color })),
      };
      const text = JSON.stringify(data, null, 2);
      const back = parseBackup(text);
      if (!back.ok) throw new Error(`검증 실패: ${back.errors[0] ?? "파일을 다시 읽지 못했어요"}`);
      if (back.shows.length !== shows.length || countSessions(back.shows) !== shows.reduce((n, x) => n + x.sessions.length, 0)) throw new Error("검증 실패: 공연·회차 수가 달라요.");
      const name = backupFileName().replace("jjabkit-backup-", "jjabkit-before-restore-");
      downloadBlob(new Blob([text], { type: "application/json" }), name);
      setPre({ name, sig: sigNow });
      setMsg(`지금 상태(공연 ${shows.length}개, 이벤트 ${events.length}개)를 ‘${name}’로 내려받았어요. 파일이 저장됐는지 직접 확인한 뒤 체크해 주세요.`);
    } catch (e) { setMsg(`복원 전 백업을 만들지 못했어요. 전체 교체는 진행할 수 없어요. (${e instanceof Error ? e.message : "알 수 없는 오류"})`); }
  };

  const doImport = async () => {
    if (!parsed) return;
    if (mode === "replace" && !preOk) { setMsg("복원 전 백업을 확인하기 전에는 전체 교체를 할 수 없어요."); return; }
    setBusy(true);
    // 전체 교체는 공연을 모두 지우고 새로 만들어요. 그러면 공연 id가 바뀌고, 공연에 붙어 있던 이벤트의 연결(show_id)이 끊겨요.
    // 그래서 지우기 전에 '이벤트 → 공연 제목'을 기억해 두었다가, 복원 뒤 같은 제목의 새 공연에 다시 이어 붙여요.
    // 제목이 같은 공연이 둘 이상이면 어느 쪽인지 알 수 없으니 이어 붙이지 않아요(백업 파일의 이벤트 목록으로 다시 입력할 수 있어요).
    const titleCount = new Map<string, number>();
    for (const x of shows) titleCount.set(x.title, (titleCount.get(x.title) ?? 0) + 1);
    const titleOf = new Map(shows.map((x) => [x.id, x.title]));
    const evAll = mode === "replace" ? events.filter((e) => e.showId && titleOf.has(e.showId)) : [];
    const evLinks = evAll.filter((e) => (titleCount.get(titleOf.get(e.showId)!) ?? 0) === 1).map((e) => ({ id: e.id, title: titleOf.get(e.showId)! }));
    const evSkipped = evAll.length - evLinks.length;
    const before = { shows: shows.length, sessions: shows.reduce((n, x) => n + x.sessions.length, 0) };
    const want = { shows: (mode === "replace" ? 0 : before.shows) + toImport.length, sessions: (mode === "replace" ? 0 : before.sessions) + countSessions(toImport) };
    let note = "";
    const ok = await run(async (d) => {
      // import_shows는 한 번에 전부 성공하거나 전부 취소돼요(DB 트랜잭션). 실패하면 기존 데이터는 그대로예요.
      const { error } = await d.rpc("import_shows", { p_data: { shows: toImport }, p_replace: mode === "replace" });
      if (error) throw new Error(error.message);
      // 여기부터는 복원이 끝난 뒤예요. 아래 단계가 실패해도 복원은 그대로 두고 안내만 해요.
      try {
        const { data, error: e2 } = await d.from("shows").select("id, title");
        if (e2) throw new Error(e2.message);
        const rows = (data ?? []) as { id: string; title: string }[];
        if (evLinks.length > 0) {
          const cnt = new Map<string, number>(), byTitle = new Map<string, string>();
          for (const r of rows) { cnt.set(r.title, (cnt.get(r.title) ?? 0) + 1); byTitle.set(r.title, r.id); }
          let linked = 0, lost = evSkipped;
          for (const l of evLinks) {
            const to = cnt.get(l.title) === 1 ? byTitle.get(l.title) : undefined;
            if (!to) { lost++; continue; }
            const { error: e3 } = await d.from("events").update({ show_id: to }).eq("id", l.id);
            if (e3) lost++; else linked++;
          }
          note += ` 이벤트 ${linked}개를 새 공연에 다시 연결했어요.${lost ? ` (${lost}개는 연결하지 못했어요. 방금 받은 복원 전 파일의 이벤트 목록을 참고해 다시 등록해 주세요)` : ""}`;
        } else if (evSkipped > 0) note += ` 이벤트 ${evSkipped}개는 제목이 같은 공연이 여럿이라 연결하지 못했어요. 복원 전 파일의 이벤트 목록을 참고해 주세요.`;
        // 복원 뒤 검증: 공연·회차 수가 기대한 값과 같은지 DB에서 다시 세어 봐요.
        const sc = await d.from("sessions").select("id", { count: "exact", head: true });
        const gotShows = rows.length;
        if (typeof sc.count === "number") {
          note += gotShows === want.shows && sc.count === want.sessions ? ` ✔ 검증 통과(공연 ${gotShows}개, 회차 ${sc.count}개).` : ` ⚠ 검증 불일치: 공연 ${gotShows}/${want.shows}, 회차 ${sc.count}/${want.sessions}. 복원 전 파일로 다시 복구할 수 있어요.`;
        } else note += gotShows === want.shows ? ` 공연 ${gotShows}개 확인(회차 수는 확인하지 못했어요).` : ` ⚠ 공연 수 불일치: ${gotShows}/${want.shows}.`;
      } catch { note += " 복원 뒤 검증·이벤트 재연결을 하지 못했어요. 공연 목록을 확인하고, 이벤트가 안 보이면 복원 전 파일을 참고해 다시 등록해 주세요."; }
    }, `공연 ${toImport.length}개를 불러왔어요.${skipped ? ` (이미 있는 ${skipped}개는 건너뛰었어요)` : ""}`);
    // 실패하면 DB는 그대로예요. 파일 선택은 남겨 두어 다시 시도할 수 있어요.
    setBusy(false);
    if (ok) { if (note) setMsg((m) => m + note); if (file.current) file.current.value = ""; setParsed(null); setConfirm(false); setPre(null); setPreSaved(false); }
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
        <p className="text-sm text-mute">지금 등록된 공연 {shows.length}개의 정보, 배역, 배우, 회차, 회차별 캐스팅을 파일 하나로 저장해요. 소식·이벤트·팝업 광고와 포스터 이미지 파일은 포함되지 않아요.</p>
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
              <div className="space-y-2 rounded-xl border border-brand bg-hit p-3 text-sm">
                <p className="font-bold">지금 등록된 공연 {shows.length}개와 그 회차가 모두 삭제돼요. 먼저 백업이 필요해요.</p>
                <button onClick={backupFirst} className={ghost}><Download size={14} aria-hidden />1단계: 지금 상태 백업 내려받기</button>
                {pre && pre.sig === sigNow ? (
                  <label className="flex items-start gap-2"><input type="checkbox" checked={preSaved} onChange={(e) => setPreSaved(e.target.checked)} className="mt-0.5 h-4 w-4" /><span>2단계: ‘{pre.name}’ 파일이 내 컴퓨터에 저장된 것을 확인했어요.</span></label>
                ) : <p className="text-xs text-mute">{pre ? "그사이 데이터가 바뀌었어요. 1단계를 다시 해 주세요." : "백업이 만들어지고 검증되기 전에는 아래 확인·불러오기가 잠겨 있어요."}</p>}
                <label className={`flex items-start gap-2 ${preOk ? "" : "opacity-50"}`}>
                  <input type="checkbox" checked={confirm} disabled={!preOk} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>3단계: 삭제되는 것을 확인했어요. (이벤트는 같은 제목의 새 공연에 다시 연결을 시도해요)</span>
                </label>
              </div>
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
