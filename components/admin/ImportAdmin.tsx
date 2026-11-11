"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Pencil, Undo2, Upload, X } from "lucide-react";
import type { Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { EVENT_TEMPLATE_HEADERS, FileReadError, TEMPLATE_HEADERS, buildTemplateXlsx, readSheetFile, readXlsx, sha256Hex } from "@/lib/xlsxLite";
import { EVENT_FIELD_LABEL, FIELD_LABEL, analyze, analyzeEvents, buildPayload, parseEventSheetRows, parsePasted, parseSheetRows, sheetKind, type AnalyzedEvent, type AnalyzedRow, type EventField, type EventImportRow, type EventStatus, type ImportRow, type RowField, type RowStatus, type ShowChoice } from "@/lib/scheduleImport";
import { isHex6 } from "@/lib/color";
import { fetchImportLogs, runImport, type ImportLog, type ImportResult } from "@/lib/db/scheduleImport";
import { downloadBlob, safeName } from "@/lib/download";
import { Sec, btn, ghost, inp, useAdminRun, friendly } from "./shared";
import { useDirty } from "./dirty";

const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  error: { label: "오류", cls: "bg-red-600 text-white" },
  new: { label: "신규", cls: "bg-brand text-onbrand" },
  existing: { label: "기존 데이터", cls: "border border-line bg-bg text-mute" },
  dup: { label: "파일 내 중복", cls: "border border-line bg-bg text-mute" },
  excluded: { label: "제외", cls: "border border-line bg-bg text-mute line-through" },
};
const EV_STATUS: Record<EventStatus, { label: string; cls: string }> = {
  error: STATUS.error, new: STATUS.new, excluded: STATUS.excluded,
  existing: { label: "이미 등록됨", cls: "border border-line bg-bg text-mute" },
  dup: STATUS.dup,
};
const EV_EDIT_FIELDS: EventField[] = ["show", "title", "start", "end"];
type Filter = "all" | "error" | "new" | "existing" | "warn";
const FILTERS: [Filter, string][] = [["all", "전체"], ["error", "오류만"], ["new", "신규"], ["existing", "기존 데이터"], ["warn", "경고"]];
const EDIT_FIELDS: RowField[] = ["title", "venue", "start", "end", "date", "time", "actor", "role", "link", "genre"];
const nowStamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const fmtAt = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** 엑셀에서 복사한 일정(회차·캐스팅)과 이벤트를 한 번에 등록해요. 붙여넣으면 먼저 미리보기만 보여 주고, '일괄 등록'을 눌러야 DB에 반영돼요. 이벤트만 따로 등록할 수도 있어요. */
export default function ImportAdmin({ shows, events = [] }: { shows: Show[]; events?: EventItem[] }) {
  const { db, run, msg, setMsg } = useAdminRun();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [meta, setMeta] = useState<{ name: string; hash: string; sheet: string } | null>(null);
  const [text, setText] = useState("");
  // 이벤트 시트: 일정과 별도로 붙여넣어요. 일정 없이 이벤트만 등록할 수도 있어요.
  const [evText, setEvText] = useState("");
  const [evRows, setEvRows] = useState<EventImportRow[] | null>(null);
  const [evMeta, setEvMeta] = useState<{ name: string; hash: string; sheet: string } | null>(null);
  const [evError, setEvError] = useState("");
  const [evExcluded, setEvExcluded] = useState<Set<number>>(new Set());
  const [evEditing, setEvEditing] = useState<number | null>(null);
  const [fileHash, setFileHash] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [updateCast, setUpdateCast] = useState(false);
  const [linkEvent, setLinkEvent] = useState(false);
  const [linkTitle, setLinkTitle] = useState("공연 안내");
  const [choice, setChoice] = useState<Record<string, ShowChoice>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [allowErrors, setAllowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ r: ImportResult; registered: number; registeredEvents: number; skipped: { row: number; title: string; date: string; time: string; actor: string; reason: string }[]; file: string } | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [logsMissing, setLogsMissing] = useState(false);
  const [openLog, setOpenLog] = useState<string | null>(null);

  useDirty("excel-import", "엑셀 붙여넣기 미리보기(아직 등록 안 됨)", !!rows || !!text.trim() || !!evRows || !!evText.trim());

  const loadLogs = useCallback(async () => {
    try { const r = await fetchImportLogs(db); setLogs(r.logs); setLogsMissing(r.missing); } catch { /* 이력을 못 불러와도 등록에는 영향 없어요 */ }
  }, [db]);
  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const analysis = useMemo(() => (rows ? analyze(rows, shows, { updateCast, choice, excluded }) : null), [rows, shows, updateCast, choice, excluded]);
  const evAnalysis = useMemo(() => (evRows ? analyzeEvents(evRows, shows, events, analysis, evExcluded) : null), [evRows, shows, events, analysis, evExcluded]);
  useEffect(() => { setConfirming(false); }, [rows, evRows, updateCast, choice, excluded, evExcluded, linkEvent, linkTitle, allowErrors]);
  const payload = useMemo(() => (analysis || evAnalysis ? buildPayload(analysis, evAnalysis) : null), [analysis, evAnalysis]);
  // 일정과 이벤트를 함께 붙여넣었으면 둘을 합친 내용으로 '같은 내용을 이미 등록했는지'를 알아봐요.
  useEffect(() => {
    const a = meta?.hash ?? "", b = evMeta?.hash ?? "";
    if (!a && !b) { setFileHash(""); return; }
    if (!a || !b) { setFileHash(a || b); return; }
    let dead = false;
    void sha256Hex(new TextEncoder().encode(`${a}|${b}`).buffer as ArrayBuffer).then((h) => { if (!dead) setFileHash(h); });
    return () => { dead = true; };
  }, [meta?.hash, evMeta?.hash]);
  const sameFile = fileHash ? logs.find((l) => l.file_hash === fileHash) : undefined;

  const resetSchedule = () => { setText(""); setConfirming(false); setRows(null); setMeta(null); setError(""); setChoice({}); setExcluded(new Set()); setEditing(null); setFilter("all"); if (fileRef.current) fileRef.current.value = ""; };
  const resetEvents = () => { setEvText(""); setConfirming(false); setEvRows(null); setEvMeta(null); setEvError(""); setEvExcluded(new Set()); setEvEditing(null); };
  const reset = () => { resetSchedule(); resetEvents(); setAllowErrors(false); };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    reset(); setResult(null); setMsg("");
    try {
      const r = await readSheetFile(f);
      // 양식(.xlsx)에 '이벤트' 시트가 있고 내용이 있으면 함께 읽어요.
      let evParsed: EventImportRow[] | null = null;
      if (r.sheet !== "CSV") {
        const er = await readXlsx(r.buf, "이벤트", true);
        if (er.sheet === "이벤트" && er.rows.length > 0 && er.rows.some((x) => x.n > 1 || x.cells.some((c) => c.trim()))) {
          const dataRows = er.rows.length;
          if (dataRows > 1 || sheetKind(er.rows) === "unknown") evParsed = parseEventSheetRows(er.rows, { allowHeaderless: true });
        }
      }
      let parsed: ImportRow[] | null = null;
      try { parsed = parseSheetRows(r.rows); } catch (e) {
        // 일정 시트가 머리글만 있고 이벤트만 채운 양식이면 이벤트만 등록해요.
        if (!(evParsed && e instanceof FileReadError && /입력된 행이 없어요/.test(e.message))) throw e;
      }
      const hash = await sha256Hex(r.buf);
      if (parsed) { setMeta({ name: f.name, hash, sheet: r.sheet }); setRows(parsed); }
      if (evParsed) { setEvMeta({ name: f.name, hash, sheet: "이벤트" }); setEvRows(evParsed); }
    } catch (e) {
      if (!(e instanceof FileReadError)) console.error("[import] 파일 읽기 실패", e);
      setError(e instanceof FileReadError ? e.message : "파일을 읽는 중 문제가 생겼어요. 엑셀 양식(.xlsx) 또는 CSV 파일인지 확인해 주세요.");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // 붙여넣은 글이 바뀌면 잠깐 뒤에 다시 분석해요(타이핑·여러 번 붙여넣기에도 화면이 버벅이지 않게).
  useEffect(() => {
    if (!text.trim()) { if (meta) { setRows(null); setMeta(null); } setError(""); return; }
    let dead = false;
    const h = setTimeout(async () => {
      try {
        const sheet = parsePasted(text);
        if (sheetKind(sheet) === "event") throw new FileReadError("이벤트 시트 내용 같아요. 이 칸은 일정 시트용이에요 — 아래 ‘이벤트 붙여넣기’ 칸에 붙여넣어 주세요.");
        const parsed = parseSheetRows(sheet, { allowHeaderless: true });
        const hash = await sha256Hex(new TextEncoder().encode(text.replace(/\r\n?/g, "\n").trim()).buffer as ArrayBuffer);
        if (dead) return;
        setError(""); setExcluded(new Set()); setChoice({}); setEditing(null); setAllowErrors(false);
        setMeta((m) => ({ name: m?.sheet === "붙여넣기" ? m.name : `엑셀 붙여넣기 (${nowStamp()})`, hash, sheet: "붙여넣기" }));
        setRows(parsed);
      } catch (e) {
        if (dead) return;
        setRows(null); setMeta(null);
        setError(e instanceof FileReadError ? e.message : "붙여넣은 내용을 읽는 중 문제가 생겼어요. 엑셀에서 다시 복사해 붙여넣어 주세요.");
      }
    }, 250);
    return () => { dead = true; clearTimeout(h); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!evText.trim()) { if (evMeta?.sheet === "붙여넣기") { setEvRows(null); setEvMeta(null); } setEvError(""); return; }
    let dead = false;
    const h = setTimeout(async () => {
      try {
        const sheet = parsePasted(evText);
        if (sheetKind(sheet) === "schedule") throw new FileReadError("일정 시트 내용 같아요. 이 칸은 이벤트 시트용이에요 — 위 ‘일정 붙여넣기’ 칸에 붙여넣어 주세요.");
        const parsed = parseEventSheetRows(sheet, { allowHeaderless: true });
        const hash = await sha256Hex(new TextEncoder().encode(`ev:${evText.replace(/\r\n?/g, "\n").trim()}`).buffer as ArrayBuffer);
        if (dead) return;
        setEvError(""); setEvExcluded(new Set()); setEvEditing(null); setAllowErrors(false);
        setEvMeta((m) => ({ name: m?.sheet === "붙여넣기" ? m.name : `이벤트 붙여넣기 (${nowStamp()})`, hash, sheet: "붙여넣기" }));
        setEvRows(parsed);
      } catch (e) {
        if (dead) return;
        setEvRows(null); setEvMeta(null);
        setEvError(e instanceof FileReadError ? e.message : "붙여넣은 이벤트를 읽는 중 문제가 생겼어요. 엑셀의 이벤트 시트에서 다시 복사해 붙여넣어 주세요.");
      }
    }, 250);
    return () => { dead = true; clearTimeout(h); };
  }, [evText]); // eslint-disable-line react-hooks/exhaustive-deps

  const evEdit = (id: number, f: EventField, v: string) => setEvRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, [f]: v } : r)));
  const toggleEvExclude = (id: number) => setEvExcluded((st) => { const n = new Set(st); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const edit = (id: number, f: RowField, v: string) => setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, [f]: v } : r)));
  const toggleExclude = (id: number) => setExcluded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const c = analysis?.counts;
  const ec = evAnalysis?.counts;
  const totalErrors = (c?.errors ?? 0) + (ec?.errors ?? 0);
  const newSessions = c?.newSessions ?? 0, newEvents = ec?.newEvents ?? 0;
  const needUpdate = newSessions === 0 && newEvents === 0 && !(updateCast && (c?.existingRows ?? 0) > 0);
  const errorBlock = totalErrors > 0 && !allowErrors;
  const canRegister = !!payload && (payload.shows.length > 0 || payload.events.length > 0) && !needUpdate && !errorBlock && !busy;

  const register = async () => {
    if (!payload || !(meta || evMeta) || !canRegister) return;
    setConfirming(false);
    setBusy(true);
    let res: ImportResult | null = null;
    const ok = await run(async (d) => {
      const fileName = meta && evMeta && evMeta.sheet === "붙여넣기" ? `${meta.name} + 이벤트` : (meta?.name ?? evMeta?.name ?? "");
      res = await runImport(d, payload, { fileName, fileHash, totalRows: (c?.total ?? 0) + (ec?.total ?? 0), errorRows: totalErrors, updateCast, linkEventTitle: linkEvent && analysis ? linkTitle.trim() : "" });
    }, (() => "일괄 등록을 마쳤어요."));
    setBusy(false);
    if (ok && res) { setResult({ r: res, registered: payload.registrableRows, registeredEvents: payload.registrableEvents, skipped: payload.skipped, file: meta?.name ?? evMeta?.name ?? "" }); reset(); void loadLogs(); }
  };

  const downloadTemplate = () => { downloadBlob(new Blob([buildTemplateXlsx() as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "jjabkit-schedule-template.xlsx"); };

  const showRow = (r: AnalyzedRow) => filter === "all" || (filter === "error" && r.status === "error") || (filter === "new" && r.status === "new") || (filter === "existing" && (r.status === "existing" || r.status === "dup")) || (filter === "warn" && r.warns.length > 0 && r.status !== "error");

  return (
    <div className="space-y-4">
      <Sec title="엑셀 붙여넣기로 일괄 등록" right={<button onClick={downloadTemplate} className={ghost} data-testid="tpl-download"><Download size={14} aria-hidden />양식 내려받기</button>}>
        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-mute">
          <li>양식을 내려받아 <b className="text-ink">일정</b> 시트(회차·캐스팅)와 <b className="text-ink">이벤트</b> 시트(공연별 이벤트)에 작성해요. 이벤트만 등록하려면 일정 칸은 비워 두세요.</li>
          <li>작성한 영역을 선택해 복사(<kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">C</kbd>)해요. 머리글 행은 포함해도, 빼도 돼요.</li>
          <li>아래 해당 칸을 클릭하고 붙여넣어요(<kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">V</kbd>). 자동으로 분석해 미리보기를 보여 줘요.</li>
        </ol>
        <p className="mt-2 text-xs text-mute">미리보기만 보여 주고, 아래 <b className="text-ink">일괄 등록</b>을 눌러 확인해야 실제로 저장돼요. 기존 공연·회차·이벤트는 새로 만들거나 지우지 않아요. 일정 열 순서: {TEMPLATE_HEADERS.join(" · ")} (공지 링크·배역명·장르는 선택). 이벤트 열 순서: {EVENT_TEMPLATE_HEADERS.join(" · ")}.</p>
        <h3 className="mt-3 text-sm font-bold">① 일정 붙여넣기</h3>
        <textarea value={text} onChange={(e) => setText(e.target.value)} wrap="off" spellCheck={false} data-testid="paste-area" aria-label="엑셀 일정 시트에서 복사한 내용 붙여넣기"
          placeholder="여기를 클릭하고 엑셀 ‘일정’ 시트에서 복사한 내용을 붙여넣으세요 (Ctrl+V)"
          className={`${inp} mt-1 h-36 resize-y whitespace-pre font-mono text-xs leading-relaxed`} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={resetSchedule} disabled={!text && !rows} className={ghost} data-testid="paste-clear"><X size={14} aria-hidden />일정 지우기</button>
          {rows && <span className="text-xs text-mute">{meta?.sheet === "붙여넣기" ? `붙여넣은 ${rows.length}행을 분석했어요.` : `${meta?.name} (${rows.length}행)`}</span>}
        </div>
        {error && <p role="alert" data-testid="import-error" className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}
        <h3 className="mt-4 text-sm font-bold">② 이벤트 붙여넣기 <span className="text-xs font-normal text-mute">(선택 — 공연명이 일정 시트 또는 이미 등록된 공연과 같아야 해요)</span></h3>
        <textarea value={evText} onChange={(e) => setEvText(e.target.value)} wrap="off" spellCheck={false} data-testid="paste-events" aria-label="엑셀 이벤트 시트에서 복사한 내용 붙여넣기"
          placeholder="여기를 클릭하고 엑셀 ‘이벤트’ 시트에서 복사한 내용을 붙여넣으세요 (Ctrl+V)"
          className={`${inp} mt-1 h-28 resize-y whitespace-pre font-mono text-xs leading-relaxed`} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={resetEvents} disabled={!evText && !evRows} className={ghost} data-testid="paste-events-clear"><X size={14} aria-hidden />이벤트 지우기</button>
          {evRows && <span className="text-xs text-mute">{evMeta?.sheet === "붙여넣기" ? `붙여넣은 이벤트 ${evRows.length}행을 분석했어요.` : `${evMeta?.name} 이벤트 시트 (${evRows.length}행)`}</span>}
        </div>
        {evError && <p role="alert" data-testid="import-event-error" className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{evError}</p>}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-mute">엑셀·CSV 파일로 올리기 (선택 — 양식의 ‘이벤트’ 시트도 함께 읽어요)</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void pick(e.target.files?.[0])} className="hidden" id="import-file" data-testid="import-file" />
            <label htmlFor="import-file" className={`${btn} cursor-pointer`}><Upload size={14} aria-hidden />파일 선택</label>
            {meta && meta.sheet !== "붙여넣기" && <span className="inline-flex items-center gap-1 text-sm"><FileSpreadsheet size={14} aria-hidden />{meta.name}</span>}
          </div>
        </details>
        {msg && !error && !evError && <p role="status" className="mt-3 text-sm text-mute">{msg}</p>}
        {logsMissing && <p className="mt-3 rounded-lg border border-line bg-hit px-3 py-2 text-xs text-brand">DB에 0014_schedule_import.sql 이 아직 적용되지 않았어요. Supabase SQL Editor에서 실행해야 일괄 등록과 업로드 이력을 쓸 수 있어요. (미리보기는 지금도 볼 수 있어요)</p>}
      </Sec>

      {result && (
        <Sec title="등록 결과" right={<button onClick={() => setResult(null)} className={ghost}>닫기</button>}>
          <div data-testid="import-result">
            <p className="mb-2 flex items-center gap-1 text-sm font-medium"><CheckCircle2 size={16} className="text-brand" aria-hidden />{result.file} — 등록을 마쳤어요.</p>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {([["신규 공연", result.r.new_shows], ["신규 회차", result.r.new_sessions], ["기존 공연(회차만 추가)", result.r.existing_shows], ["기존 회차(건드리지 않음)", result.r.existing_sessions], ["새 배역", result.r.new_roles], ["새 배우", result.r.new_actors], ["캐스팅 변경", result.r.updated_casts], ["링크 이벤트 생성", result.r.link_events], ["신규 이벤트", result.r.new_events ?? 0], ["이미 있던 이벤트(건너뜀)", result.r.existing_events ?? 0]] as [string, number][]).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line p-2"><dt className="text-xs text-mute">{k}</dt><dd className="text-lg font-bold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-sm" data-testid="result-rows">성공 처리 <b>{result.registered + result.registeredEvents}</b>행{result.registeredEvents ? <> (이벤트 {result.registeredEvents}행 포함)</> : null} · 등록하지 않은 행 <b>{result.skipped.length}</b>행</p>
            <p className="mt-1 text-sm">등록하지 않은 행 <b data-testid="skipped-count">{result.skipped.length}</b>개{result.skipped.length ? "의 사유:" : "."}</p>
            {result.skipped.length > 0 && <SkippedList items={result.skipped} />}
          </div>
        </Sec>
      )}

      {(analysis || evAnalysis) && payload && (
        <Sec title="미리보기">
          {sameFile && <p data-testid="same-file" role="status" className="mb-3 rounded-lg border border-brand bg-hit px-3 py-2 text-sm text-brand">이 파일과 같은 내용을 {fmtAt(sameFile.created_at)}에 이미 등록했어요. 다시 등록해도 이미 있는 공연·회차·이벤트는 새로 만들어지지 않아요.</p>}
          {analysis && c && (<>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-7" data-testid="summary">
            {([["신규 공연", c.newShows, ""], ["기존 공연", c.existingShows, ""], ["신규 회차", c.newSessions, ""], ["기존 회차(유지)", c.existingSessions, ""], ["배우 배정", c.assignments, ""], ["오류 행", c.errors, c.errors ? "text-red-600" : ""], ["확인 필요(경고)", c.warnRows, c.warnRows ? "text-gold" : ""]] as [string, number, string][]).map(([k, v, cls]) => (
              <div key={k} className="rounded-lg border border-line p-2"><div className="text-[11px] text-mute">{k}</div><div className={`text-lg font-bold ${cls}`}>{v}</div></div>
            ))}
          </div>
          <p className="mt-1 text-xs text-mute">전체 {c.total}행{c.dups ? ` · 파일 내 중복 ${c.dups}행` : ""}{c.excluded ? ` · 제외 ${c.excluded}행` : ""}</p>

          <div className="mt-3 space-y-2 rounded-lg border border-line p-3 text-sm">
            <label className="flex items-start gap-2"><input type="checkbox" checked={updateCast} onChange={(e) => setUpdateCast(e.target.checked)} className="mt-1" data-testid="opt-update" />
              <span>이미 등록된 회차의 캐스팅도 엑셀대로 바꾸기 <span className="text-xs text-mute">(기본 꺼짐 = 기존 캐스팅 유지. 켜면 엑셀에 적은 배역만 바뀌고 나머지는 그대로예요)</span></span></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={linkEvent} onChange={(e) => setLinkEvent(e.target.checked)} className="mt-1" data-testid="opt-link" />
              <span>공지 링크가 있는 공연은 링크 이벤트로도 등록하기 <span className="text-xs text-mute">(공연 기간 전체에 표시. 기본 꺼짐)</span></span></label>
            {linkEvent && <label className="block text-xs text-mute">이벤트 제목<input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} maxLength={40} className={`${inp} mt-1 max-w-xs`} /></label>}
          </div>

          <div role="group" aria-label="보기 필터" className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? "border-brand bg-hit text-brand" : "border-line text-mute"}`}>{l}</button>)}
          </div>

          <div className="mt-3 space-y-4">
            {analysis.groups.map((g) => {
              const list = analysis.rows.filter((r) => g.rowIds.includes(r.id) && showRow(r));
              if (!list.length) return null;
              return (
                <div key={g.key} data-testid="group" className="rounded-xl border border-line">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-3 py-2">
                    <span className="font-bold">{g.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.mode === "new" ? "bg-brand text-onbrand" : "border border-line text-mute"}`}>{g.mode === "new" ? "신규 공연" : "기존 공연"}</span>
                    <span className="text-xs text-mute">{g.venue} · {g.start && g.end ? `${g.start} ~ ${g.end}` : "기간 미확인"} · 신규 회차 {g.newSessions} · 기존 회차 {g.existingSessions}{g.errorRows ? ` · 오류 ${g.errorRows}행` : ""}</span>
                    {g.existingId && (
                      <label className="ml-auto text-xs text-mute">처리 방식 <select value={g.mode} onChange={(e) => setChoice((s) => ({ ...s, [g.key]: e.target.value as ShowChoice }))} className="ml-1 rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink" data-testid="group-mode">
                        <option value="existing">기존 공연에 회차 추가{g.periodMatch ? "" : ` (기존 ${g.existingPeriod})`}</option>
                        <option value="new">새 공연으로 등록</option></select></label>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="text-xs text-mute"><tr>{["행", "공연일", "시간", "배우명", "배역(자동 포함)", "상태", "안내", ""].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                      <tbody>
                        {list.map((r) => <PreviewRow key={r.id} r={r} editing={editing === r.id} onEditToggle={() => setEditing(editing === r.id ? null : r.id)} onExclude={() => toggleExclude(r.id)} />)}
                      </tbody>
                    </table>
                  </div>
                  {list.filter((r) => r.id === editing).map((r) => <RowEditor key={r.id} r={r} onEdit={edit} onClose={() => setEditing(null)} />)}
                </div>
              );
            })}
            {(rows ?? []).some((r) => !r.title.trim()) && analysis.rows.some((r) => !r.groupKey && showRow(r)) && (
              <div className="rounded-xl border border-red-300"><div className="border-b border-red-300 px-3 py-2 text-sm font-bold text-red-700">공연명이 없는 행</div>
                <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><tbody>
                  {analysis.rows.filter((r) => !r.groupKey && showRow(r)).map((r) => <PreviewRow key={r.id} r={r} editing={editing === r.id} onEditToggle={() => setEditing(editing === r.id ? null : r.id)} onExclude={() => toggleExclude(r.id)} />)}
                </tbody></table></div>
                {analysis.rows.filter((r) => !r.groupKey && r.id === editing).map((r) => <RowEditor key={r.id} r={r} onEdit={edit} onClose={() => setEditing(null)} />)}</div>
            )}
          </div>
          </>)}

          {evAnalysis && ec && (
            <div className="mt-4" data-testid="event-preview">
              <h3 className="text-sm font-bold">이벤트 미리보기</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-5" data-testid="event-summary">
                {([["신규 이벤트", ec.newEvents, ""], ["이벤트가 붙는 공연", ec.shows, ""], ["이미 등록됨(건너뜀)", ec.existing + ec.dups, ""], ["오류 행", ec.errors, ec.errors ? "text-red-600" : ""], ["확인 필요(경고)", ec.warnRows, ec.warnRows ? "text-gold" : ""]] as [string, number, string][]).map(([k, v, cls]) => (
                  <div key={k} className="rounded-lg border border-line p-2"><div className="text-[11px] text-mute">{k}</div><div className={`text-lg font-bold ${cls}`}>{v}</div></div>
                ))}
              </div>
              <p className="mt-1 text-xs text-mute">전체 {ec.total}행{ec.dups ? ` · 파일 내 중복 ${ec.dups}행` : ""}{ec.excluded ? ` · 제외 ${ec.excluded}행` : ""} · 이벤트 기간은 공연 기간과 별개이고, 기간이 겹쳐도 등록돼요. 이벤트 색은 공연 색을 따라가요.</p>
              <div className="mt-3 space-y-4">
                {evAnalysis.groups.map((g) => {
                  const list = evAnalysis.rows.filter((r) => g.rowIds.includes(r.id));
                  return (
                    <div key={g.key} data-testid="event-group" className="rounded-xl border border-line">
                      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-3 py-2">
                        <span className="font-bold">{g.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.kind === "missing" ? "bg-red-600 text-white" : g.kind === "sheet-new" ? "bg-brand text-onbrand" : "border border-line text-mute"}`}>
                          {g.kind === "sheet-new" ? "신규 공연(일정과 함께 등록)" : g.kind === "sheet-existing" ? "기존 공연(일정 시트에도 있음)" : g.kind === "existing" ? "기존 공연" : "공연을 찾을 수 없음"}
                        </span>
                        {g.kind !== "missing" && (
                          <span className="inline-flex items-center gap-1 text-xs text-mute" data-testid="event-group-color">
                            {isHex6(g.color) ? <><span aria-hidden className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: g.color }} />공연 색 {g.color}</> : "공연 색은 등록할 때 자동 배정돼요"}
                          </span>
                        )}
                        <span className="text-xs text-mute">신규 {g.newEvents}{g.existingEvents ? ` · 이미 등록 ${g.existingEvents}` : ""}{g.errorRows ? ` · 오류 ${g.errorRows}행` : ""}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead className="text-xs text-mute"><tr>{["행", "이벤트명", "시작일", "종료일", "상태", "안내", ""].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                          <tbody>{list.map((r) => <EventPreviewRow key={r.id} r={r} onEditToggle={() => setEvEditing(evEditing === r.id ? null : r.id)} editing={evEditing === r.id} onExclude={() => toggleEvExclude(r.id)} />)}</tbody>
                        </table>
                      </div>
                      {list.filter((r) => r.id === evEditing).map((r) => <EventRowEditor key={r.id} r={r} onEdit={evEdit} onClose={() => setEvEditing(null)} />)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-line pt-3">
            {totalErrors > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={allowErrors} onChange={(e) => setAllowErrors(e.target.checked)} className="mt-1" data-testid="allow-errors" />
              <span>오류가 있는 {totalErrors}행은 <b>제외하고</b> 나머지만 등록할게요 <span className="text-xs text-mute">(제외한 행은 결과에 사유와 함께 남아요. 위에서 직접 고치면 같이 등록돼요)</span></span></label>}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setConfirming(true)} disabled={!canRegister || confirming} className={btn} data-testid="register">{busy ? "등록 중…" : `일괄 등록 (${analysis ? `신규 회차 ${newSessions}개` : ""}${analysis && evAnalysis ? " · " : ""}${evAnalysis ? `신규 이벤트 ${newEvents}개` : ""})`}</button>
              <span className="text-xs text-mute">{needUpdate ? (evAnalysis ? "새로 등록할 회차·이벤트가 없어요(전부 기존 데이터)." : payload.shows.length ? "새로 등록할 회차가 없어요(전부 기존 데이터)." : "등록할 행이 없어요.") : errorBlock ? "오류를 고치거나 위 체크박스로 제외해 주세요." : "한 번에 처리돼요 — 중간에 실패하면 아무것도 등록되지 않아요."}</span>
            </div>
            {confirming && canRegister && (
              <div role="alertdialog" aria-label="최종 확인" data-testid="confirm-box" className="rounded-lg border border-brand bg-hit p-3 text-sm">
                <p className="font-bold text-brand">이대로 등록할까요?</p>
                <p className="mt-1">{c ? <>신규 공연 <b>{c.newShows}</b>개 · 신규 회차 <b>{c.newSessions}</b>개 · 배우 배정 <b>{c.assignments}</b>건{c.existingSessions ? <> · 기존 회차 <b>{c.existingSessions}</b>개{updateCast ? "(캐스팅을 엑셀대로 변경)" : "(그대로 유지)"}</> : null}</> : null}{ec ? <>{c ? " · " : ""}신규 이벤트 <b>{ec.newEvents}</b>개{ec.existing + ec.dups ? <> (이미 있는 이벤트 <b>{ec.existing + ec.dups}</b>개는 건너뜀)</> : null}</> : null}{totalErrors ? <> · 오류로 등록하지 않는 행 <b>{totalErrors}</b>개</> : null}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void register()} disabled={busy} className={btn} data-testid="register-confirm">확인, 등록할게요</button>
                  <button onClick={() => setConfirming(false)} className={ghost} data-testid="register-cancel">취소</button>
                </div>
              </div>
            )}
          </div>
        </Sec>
      )}

      <Sec title="업로드 이력">
        {logs.length === 0 ? <p className="text-sm text-mute">{logsMissing ? "0014 SQL 적용 후 이력이 쌓여요." : "아직 업로드한 기록이 없어요."}</p> : (
          <ul className="divide-y divide-line text-sm" data-testid="history">
            {logs.map((l) => (
              <li key={l.id} className="py-2">
                <button onClick={() => setOpenLog(openLog === l.id ? null : l.id)} aria-expanded={openLog === l.id} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
                  <span className="text-xs text-mute">{fmtAt(l.created_at)}</span>
                  <span className="min-w-0 break-all font-medium">{l.file_name || "(이름 없음)"}</span>
                  <span className="text-xs text-mute">신규 공연 {l.new_shows} · 신규 회차 {l.new_sessions} · 기존 회차 {l.existing_sessions}{l.new_events ? ` · 신규 이벤트 ${l.new_events}` : ""}{l.error_rows ? ` · 오류 ${l.error_rows}` : ""}</span>
                  <ChevronDown size={14} className={`ml-auto transition ${openLog === l.id ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {openLog === l.id && (
                  <div className="mt-2 space-y-1 rounded-lg bg-bg p-2 text-xs text-mute">
                    <p>전체 {l.total_rows}행 · 기존 공연에 추가 {l.existing_shows} · 새 배역 {l.new_roles} · 새 배우 {l.new_actors} · 캐스팅 변경 {l.updated_casts} · 이벤트 생성 {l.link_events}{l.existing_events ? ` · 이미 있던 이벤트 ${l.existing_events}` : ""}{l.update_cast ? " · 기존 캐스팅 변경 옵션 켬" : ""}</p>
                    {l.skipped.length > 0 ? <SkippedList items={l.skipped} /> : <p>등록하지 않은 행이 없어요.</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sec>
    </div>
  );
}

function SkippedList({ items }: { items: { row: number; title: string; date: string; time: string; actor: string; reason: string }[] }) {
  return (
    <ul className="mt-1 max-h-60 space-y-1 overflow-y-auto text-xs" data-testid="skipped-list">
      {items.map((s, i) => <li key={i} className="rounded border border-line bg-card px-2 py-1"><b className="text-ink">{s.row}행</b> {s.title} {s.date} {s.time} {s.actor} — <span className="text-red-600">{s.reason}</span></li>)}
    </ul>
  );
}

function PreviewRow({ r, editing, onEditToggle, onExclude }: { r: AnalyzedRow; editing: boolean; onEditToggle: () => void; onExclude: () => void }) {
  const st = STATUS[r.status];
  const bad = r.status === "error";
  return (
    <>
      <tr data-testid="row" data-status={r.status} className={`border-t border-line align-top ${bad ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
        <td className="px-2 py-1.5 text-xs text-mute">{r.n}</td>
        <td className="px-2 py-1.5 whitespace-nowrap">{r.date || r.raw.date}</td>
        <td className="px-2 py-1.5 whitespace-nowrap">{r.time || r.raw.time}</td>
        <td className="px-2 py-1.5 whitespace-nowrap">{r.raw.actor}</td>
        <td className="px-2 py-1.5 text-xs whitespace-nowrap">{r.roleText || r.raw.role || "-"}</td>
        <td className="px-2 py-1.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></td>
        <td className="min-w-[220px] px-2 py-1.5 text-xs">
          {r.errors.map((m, i) => <p key={`e${i}`} className="text-red-600">⚠ {m}</p>)}
          {r.warns.map((m, i) => <p key={`w${i}`} className="text-gold">△ {m}</p>)}
          {r.notes.map((m, i) => <p key={`n${i}`} className="text-mute">{m}</p>)}
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">
          <button onClick={onEditToggle} aria-expanded={editing} className="mr-1 inline-flex items-center gap-0.5 rounded border border-line px-2 py-1 text-xs hover:border-brand"><Pencil size={12} aria-hidden />수정</button>
          <button onClick={onExclude} className="inline-flex items-center gap-0.5 rounded border border-line px-2 py-1 text-xs hover:border-brand">{r.status === "excluded" ? <><Undo2 size={12} aria-hidden />되돌리기</> : <><X size={12} aria-hidden />제외</>}</button>
        </td>
      </tr>
    </>
  );
}

function EventPreviewRow({ r, editing, onEditToggle, onExclude }: { r: AnalyzedEvent; editing: boolean; onEditToggle: () => void; onExclude: () => void }) {
  const st = EV_STATUS[r.status];
  const bad = r.status === "error";
  return (
    <tr data-testid="event-row" data-status={r.status} className={`border-t border-line align-top ${bad ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
      <td className="px-2 py-1.5 text-xs text-mute">{r.n}</td>
      <td className="px-2 py-1.5">{r.raw.title}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{r.start || r.raw.start}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{r.end || r.raw.end}</td>
      <td className="px-2 py-1.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></td>
      <td className="min-w-[200px] px-2 py-1.5 text-xs">
        {r.errors.map((m, i) => <p key={`e${i}`} className="text-red-600">⚠ {m}</p>)}
        {r.warns.map((m, i) => <p key={`w${i}`} className="text-gold">△ {m}</p>)}
        {r.notes.map((m, i) => <p key={`n${i}`} className="text-mute">{m}</p>)}
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <button onClick={onEditToggle} aria-expanded={editing} className="mr-1 inline-flex items-center gap-0.5 rounded border border-line px-2 py-1 text-xs hover:border-brand"><Pencil size={12} aria-hidden />수정</button>
        <button onClick={onExclude} className="inline-flex items-center gap-0.5 rounded border border-line px-2 py-1 text-xs hover:border-brand">{r.status === "excluded" ? <><Undo2 size={12} aria-hidden />되돌리기</> : <><X size={12} aria-hidden />제외</>}</button>
      </td>
    </tr>
  );
}

function EventRowEditor({ r, onEdit, onClose }: { r: AnalyzedEvent; onEdit: (id: number, f: EventField, v: string) => void; onClose: () => void }) {
  return (
    <div className="border-t border-line bg-bg px-3 py-3" data-testid="event-editor">
      <p className="mb-2 flex items-center justify-between text-xs font-medium text-mute"><span>이벤트 {r.n}행 수정 — 고치면 바로 다시 검사해요</span><button onClick={onClose} className="rounded border border-line px-2 py-1">닫기</button></p>
      {r.errors.map((m, i) => <p key={i} className="mb-1 text-xs text-red-600">⚠ {m}</p>)}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EV_EDIT_FIELDS.map((f) => (
          <label key={f} className="block text-[11px] text-mute">{EVENT_FIELD_LABEL[f]}
            <input value={r.raw[f]} onChange={(e) => onEdit(r.id, f, e.target.value)} className={`${inp} mt-0.5 !py-1.5`} data-testid={`ev-edit-${f}`} />
          </label>
        ))}
      </div>
    </div>
  );
}

/** 표 밖(가로 스크롤 바깥)에 펼쳐서 모바일에서도 입력하기 편하게 해요. */
function RowEditor({ r, onEdit, onClose }: { r: AnalyzedRow; onEdit: (id: number, f: RowField, v: string) => void; onClose: () => void }) {
  return (
    <div className="border-t border-line bg-bg px-3 py-3" data-testid="editor">
      <p className="mb-2 flex items-center justify-between text-xs font-medium text-mute"><span>{r.n}행 수정 — 고치면 바로 다시 검사해요</span><button onClick={onClose} className="rounded border border-line px-2 py-1">닫기</button></p>
      {r.errors.map((m, i) => <p key={i} className="mb-1 text-xs text-red-600">⚠ {m}</p>)}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {EDIT_FIELDS.map((f) => (
          <label key={f} className="block text-[11px] text-mute">{FIELD_LABEL[f]}
            <input value={r.raw[f]} onChange={(e) => onEdit(r.id, f, e.target.value)} className={`${inp} mt-0.5 !py-1.5`} data-testid={`edit-${f}`} />
          </label>
        ))}
      </div>
    </div>
  );
}
