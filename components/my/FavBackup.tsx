"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { useMySched } from "@/lib/mySched";
import { linkRecords, useWatched, type WatchedRecord } from "@/lib/watched";
import { buildFavBackup, favBackupFileName, parseFavBackup, type FavParse } from "@/lib/favBackup";
import { downloadBlob } from "@/lib/download";

/** 복원 직전 상태. 복원이 실패하거나 마음이 바뀌면 이걸로 되돌려요(이 브라우저에만 저장). */
interface Snapshot { shows: string[]; actors: string[]; sessions: string[]; watched: WatchedRecord[] }
const SNAP_KEY = "jjabkit-prerestore-v1";
const same = (a: Iterable<string>, b: Iterable<string>) => { const x = new Set(a), y = new Set(b); return x.size === y.size && [...x].every((v) => y.has(v)); };

type Mode = "merge" | "replace";
const card = "rounded-2xl border border-line bg-card p-4";
const btn = "inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-onbrand disabled:opacity-50";
const ghost = "inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand";

/** 데이터 백업 화면. 누구나: 내 하트(관심 공연·배우) 백업/복구. 관리자: 공연 데이터 백업 화면으로 가는 링크. */
export default function FavBackup({ shows, isAdmin }: { shows: { id: string; title: string; sessions?: { id: string; date: string; time: string }[] }[]; isAdmin: boolean }) {
  const fav = useFavorites();
  const mine = useMySched();
  const watched = useWatched();
  const file = useRef<HTMLInputElement>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const [parsed, setParsed] = useState<Extract<FavParse, { ok: true }> | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("merge");
  const [msg, setMsg] = useState("");
  // 전체 교체는 2단계: (1) 지금 상태를 파일로 내려받고 (2) 저장된 것을 직접 확인해야 풀려요.
  const [backedUp, setBackedUp] = useState<string | null>(null); // 내려받은 파일 이름(검증까지 통과했을 때만)
  const [savedOk, setSavedOk] = useState(false);
  const [undoable, setUndoable] = useState(false);

  const makeBackup = (): { text: string; counts: { shows: number; actors: number; sessions: number; watched: number } } => {
    const d = buildFavBackup(shows, fav.shows, fav.actors, new Date(), mine.ids, watched.records);
    const text = JSON.stringify(d, null, 2);
    // 다운로드를 호출했다는 것만으로는 성공이 아니에요. 만든 파일을 다시 읽어 보고, 내용이 지금 데이터와 맞을 때만 인정해요.
    const back = parseFavBackup(text, shows);
    if (!back.ok) throw new Error(`백업 파일 검증 실패: ${back.error}`);
    if (!same(back.showIds, fav.shows) && fav.shows.size > 0 && back.showIds.length !== [...fav.shows].filter((id) => shows.some((s) => s.id === id)).length) throw new Error("백업 파일 검증 실패: 관심 공연 수가 달라요.");
    if (!same(back.actors, fav.actors)) throw new Error("백업 파일 검증 실패: 관심 배우가 달라요.");
    if ((back.sessionIds ?? []).length !== (d.mySessions ?? []).length) throw new Error("백업 파일 검증 실패: 내 일정 수가 달라요.");
    if ((back.watched ?? []).length !== watched.records.length) throw new Error("백업 파일 검증 실패: 관극 완료 기록 수가 달라요.");
    return { text, counts: { shows: d.shows.length, actors: d.actors.length, sessions: d.mySessions?.length ?? 0, watched: d.watched?.length ?? 0 } };
  };

  const exportJson = () => {
    try {
      const { text, counts: c } = makeBackup();
      downloadBlob(new Blob([text], { type: "application/json" }), favBackupFileName());
      setMsg(`관심 공연 ${c.shows}개, 관심 배우 ${c.actors}명, 내 일정 ${c.sessions}개, 관극 완료 ${c.watched}회를 내려받았어요.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "백업 파일을 만들지 못했어요."); }
  };

  /** 전체 교체 1단계: 지금 상태를 검증된 파일로 내려받아요. 실패하면 2단계로 넘어갈 수 없어요. */
  const backupBeforeReplace = () => {
    setBackedUp(null); setSavedOk(false);
    try {
      const { text } = makeBackup();
      const name = favBackupFileName().replace("jjabkit-hearts-", "jjabkit-before-restore-");
      downloadBlob(new Blob([text], { type: "application/json" }), name);
      setBackedUp(name);
      setMsg(`지금 상태를 ‘${name}’로 내려받았어요. 파일이 저장됐는지 직접 확인한 뒤 아래 체크를 해 주세요.`);
    } catch (e) { setMsg(`복원 전 백업을 만들지 못했어요. 복원은 진행하지 않아요. (${e instanceof Error ? e.message : "알 수 없는 오류"})`); }
  };

  const pick = async (f: File | undefined) => {
    setParsed(null); setError(""); setMsg(""); setBackedUp(null); setSavedOk(false);
    if (!f) return;
    const r = parseFavBackup(await f.text(), shows);
    if (r.ok) setParsed(r); else setError(r.error);
  };

  const readSnapshot = (): Snapshot => ({ shows: [...fav.shows], actors: [...fav.actors], sessions: [...mine.ids], watched: watched.records });
  const restoreSnapshot = (sn: Snapshot) => { fav.replaceAll(new Set(sn.shows), new Set(sn.actors)); mine.replaceAll(new Set(sn.sessions)); watched.replaceAll(sn.watched); };

  const apply = () => {
    if (!parsed) return;
    if (mode === "replace" && !(backedUp && savedOk)) return; // 백업 확인 없이는 전체 교체를 하지 않아요
    const before = readSnapshot();
    try { localStorage.setItem(SNAP_KEY, JSON.stringify({ at: new Date().toISOString(), ...before })); } catch { /* 되돌리기 보관 실패는 무시(화면 안 되돌리기는 계속 가능) */ }
    snapRef.current = before;
    try {
      const s = new Set(parsed.showIds), a = new Set(parsed.actors);
      if (mode === "merge") { fav.shows.forEach((x) => s.add(x)); fav.actors.forEach((x) => a.add(x)); }
      fav.replaceAll(s, a);
      let nextSessions = new Set(mine.ids);
      if (parsed.sessionIds) { // 내 일정이 들어 있는 파일일 때만 바꿔요. 예전 파일이면 지금 내 일정은 그대로예요.
        nextSessions = new Set(parsed.sessionIds);
        if (mode === "merge") mine.ids.forEach((x) => nextSessions.add(x));
        mine.replaceAll(nextSessions);
      }
      let nextWatched = watched.records;
      if (parsed.watched) { // 관극 기록이 들어 있는 파일일 때만 바꿔요. 예전 파일이면 지금 기록은 그대로예요.
        const base = mode === "merge" ? watched.records : [];
        nextWatched = linkRecords([...base, ...parsed.watched], shows).records; // 회차 id와 안전하게 연결(모호하면 연결하지 않고 보관)
        watched.replaceAll(nextWatched);
      }
      // 복원 뒤 검증: 저장소에 실제로 들어간 값이 기대한 값과 같은지 확인해요. 다르면 복원 직전 상태로 되돌려요.
      const exp = { s, a, sessions: nextSessions, watchedN: nextWatched.length };
      const keep = parsed; // eslint-disable-line @typescript-eslint/no-unused-vars
      window.setTimeout(() => {
        let ok = true;
        try {
          const f = JSON.parse(localStorage.getItem("jjabkit-fav-v1") ?? "{}");
          const m = JSON.parse(localStorage.getItem("jjabkit-mysched-v1") ?? "{}");
          ok = same(f.shows ?? [], exp.s) && same(f.actors ?? [], exp.a) && same(m.sessions ?? [], exp.sessions) && watched.stored().length === exp.watchedN;
        } catch { ok = false; }
        if (ok) { setUndoable(true); setMsg((p) => `${p} ✔ 저장 검증 통과(관심 공연 ${exp.s.size}, 관심 배우 ${exp.a.size}, 내 일정 ${exp.sessions.size}, 관극 완료 ${exp.watchedN}).`); }
        else { restoreSnapshot(before); setUndoable(false); setMsg("복원 결과를 검증하지 못해 복원 직전 상태로 되돌렸어요. 아무것도 바뀌지 않았어요."); }
      }, 80);
      const bad = parsed.watchedRejected.length;
      setMsg(`불러왔어요. 관심 공연 ${s.size}개, 관심 배우 ${a.size}명, 내 일정 ${nextSessions.size}개, 관극 완료 ${nextWatched.length}회예요.${parsed.unmatched.length ? ` (지금 없는 공연 ${parsed.unmatched.length}개는 건너뛰었어요)` : ""}${parsed.unmatchedSessions ? ` (연결할 수 없는 회차 ${parsed.unmatchedSessions}개는 건너뛰었어요)` : ""}${bad ? ` 관극 기록 ${bad}개는 날짜·시간이 잘못돼 제외하고 나머지 ${parsed.watched?.length ?? 0}개를 불러왔어요.` : ""}`);
    } catch (e) {
      restoreSnapshot(before); setUndoable(false);
      setMsg(`복원 중 오류가 나서 복원 직전 상태로 되돌렸어요. (${e instanceof Error ? e.message : "알 수 없는 오류"})`);
    }
    setParsed(null); setBackedUp(null); setSavedOk(false);
    if (file.current) file.current.value = "";
  };
  const undo = () => {
    let sn = snapRef.current;
    if (!sn) { try { sn = JSON.parse(localStorage.getItem(SNAP_KEY) ?? "null"); } catch { sn = null; } }
    if (!sn) { setMsg("되돌릴 복원 기록이 없어요."); return; }
    restoreSnapshot(sn); setUndoable(false); setMsg("복원 직전 상태로 되돌렸어요.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-5">
      <header>
        <h1 className="font-serif text-xl font-bold">데이터 백업</h1>
        <p className="mt-1 text-xs text-mute">하트와 내 일정은 이 브라우저에만 저장돼요. 브라우저를 바꾸거나 사이트 데이터를 지우면 사라지니, 파일로 백업해 두면 안전해요.</p>
      </header>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>
      {undoable && <button onClick={undo} className={ghost}>방금 복원 되돌리기</button>}

      <section className={card}>
        <h2 className="font-bold">내 하트·내 일정 백업</h2>
        <p className="mt-1 text-sm text-mute">관심 공연 {fav.shows.size}개 · 관심 배우 {fav.actors.size}명 · 내 일정 {mine.ids.size}개 · 관극 완료 {watched.records.length}회</p>
        <button onClick={exportJson} disabled={!fav.ready} className={`${btn} mt-3`}><Download size={14} aria-hidden />JSON 파일 내려받기</button>
      </section>

      <section className={card}>
        <h2 className="font-bold">내 하트·내 일정 불러오기</h2>
        <p className="mt-1 text-sm text-mute">위에서 내려받은 파일만 불러올 수 있어요. 내용은 먼저 검사해요.</p>
        <input ref={file} type="file" accept="application/json,.json" aria-label="하트 백업 JSON 파일 선택" onChange={(e) => pick(e.target.files?.[0])}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-2 file:text-sm" />
        {error && <p role="alert" className="mt-3 flex items-start gap-1 rounded-xl border border-brand bg-hit p-3 text-sm"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}
        {parsed && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-line bg-bg p-3 text-sm">
              파일 안: 관심 공연 {parsed.showIds.length}개 · 관심 배우 {parsed.actors.length}명{parsed.sessionIds ? ` · 내 일정 ${parsed.sessionIds.length}개` : " · (내 일정 없는 예전 파일: 지금 내 일정은 그대로 둬요)"}{parsed.watched ? ` · 관극 완료 ${parsed.watched.length}회` : ""}
              {parsed.unmatchedSessions > 0 && <p className="mt-1 text-xs text-mute">지금 없는 회차라 건너뛰는 내 일정: {parsed.unmatchedSessions}개</p>}
              {parsed.unmatched.length > 0 && <p className="mt-1 text-xs text-mute">지금 없는 공연이라 건너뛰는 항목: {parsed.unmatched.slice(0, 5).join(", ")}{parsed.unmatched.length > 5 ? ` 외 ${parsed.unmatched.length - 5}개` : ""}</p>}
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-mute">불러오는 방식</legend>
              {([["merge", "지금 하트에 합치기", "지금 등록된 하트·내 일정은 그대로 두고 파일의 것을 더해요."], ["replace", "파일 내용으로 바꾸기", "지금 하트·내 일정을 지우고 파일의 것만 남겨요."]] as const).map(([v, l, h]) => (
                <label key={v} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="fav-mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
                  <span><b>{l}</b><span className="block text-xs text-mute">{h}</span></span>
                </label>
              ))}
            </fieldset>
            {mode === "replace" && (
              <div className="space-y-2 rounded-xl border border-brand bg-hit p-3 text-sm">
                <p className="font-bold">전체 교체는 지금 하트·내 일정·관극 기록을 모두 지워요. 먼저 백업이 필요해요.</p>
                <button onClick={backupBeforeReplace} className={ghost}><Download size={14} aria-hidden />1단계: 지금 상태 백업 내려받기</button>
                {backedUp
                  ? <label className="flex items-start gap-2"><input type="checkbox" checked={savedOk} onChange={(e) => setSavedOk(e.target.checked)} className="mt-0.5 h-4 w-4" /><span>2단계: ‘{backedUp}’ 파일이 내 기기에 저장된 것을 확인했어요.</span></label>
                  : <p className="text-xs text-mute">백업이 만들어지고 검증되기 전에는 불러오기 버튼이 잠겨 있어요.</p>}
              </div>
            )}
            {parsed.watchedRejected.length > 0 && (
              <div role="alert" className="rounded-xl border border-line bg-bg p-3 text-sm">
                <b>관극 기록 {parsed.watchedRejected.length}개는 불러올 수 없어요.</b> 나머지 정상 기록 {parsed.watched?.length ?? 0}개는 그대로 불러와요.
                <ul className="mt-1 list-disc pl-5 text-xs text-mute">{parsed.watchedRejected.slice(0, 5).map((r) => <li key={r.index}>{r.index + 1}번째 항목: {r.reason}</li>)}{parsed.watchedRejected.length > 5 && <li>…외 {parsed.watchedRejected.length - 5}개</li>}</ul>
              </div>
            )}
            {parsed.ambiguous > 0 && <p className="text-xs text-mute">제목이 같은 공연·회차가 여럿이라 어느 쪽인지 알 수 없는 항목 {parsed.ambiguous}개는 연결하지 않고 건너뛰었어요.</p>}
            <div className="flex gap-2">
              <button onClick={apply} disabled={mode === "replace" && !(backedUp && savedOk)} className={btn}><Upload size={14} aria-hidden />불러오기</button>
              <button onClick={() => { setParsed(null); setBackedUp(null); setSavedOk(false); if (file.current) file.current.value = ""; }} className={ghost}>취소</button>
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
