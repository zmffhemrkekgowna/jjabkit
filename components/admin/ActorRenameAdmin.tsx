"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Undo2 } from "lucide-react";
import type { Show } from "@/types/show";
import { actorStats, previewRename, renameProblem } from "@/lib/actorRename";
import { listRenames, renameActor, undoActorRename, type RenameLog, type RenameResult, type UndoResult } from "@/lib/db/actorRename";
import { STATUS_LABEL, statusOf } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import { Fld, Sec, btn, ghost, inp, useAdminRun } from "./shared";
import { LoadingInline } from "@/components/ui/Loading";

const statusLabel = (s: { start: string; end: string }, today: string) => { const st = statusOf(s, today); return st ? STATUS_LABEL[st] : "날짜 미정"; };
const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** 배우 이름을 모든 공연·회차에서 한 번에 바꿔요. 배우 id와 회차 연결은 그대로 두고 이름만 바꾸며, 기록에서 되돌릴 수 있어요. */
export default function ActorRenameAdmin({ shows }: { shows: Show[] }) {
  const { db, run, msg, setMsg } = useAdminRun();
  const today = useTodayKST();
  const [oldName, setOldName] = useState("");
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<RenameLog[] | null | undefined>(undefined); // undefined=불러오는 중, null=0017 미적용
  const [undoId, setUndoId] = useState<string | null>(null);
  const [done, setDone] = useState<string>("");

  const stats = useMemo(() => actorStats(shows), [shows]);
  const o = oldName.trim(), n = newName.trim();
  const found = stats.some((s) => s.name === o);
  const problem = renameProblem(oldName, newName, found);
  const preview = useMemo(() => (found ? previewRename(shows, o, n) : null), [shows, found, o, n]);
  const matches = useMemo(() => {
    const q = o.toLowerCase();
    return (q ? stats.filter((s) => s.name.toLowerCase().includes(q)) : stats).slice(0, 12);
  }, [stats, o]);

  const loadLogs = useCallback(async () => { try { setLogs(await listRenames(db)); } catch { setLogs([]); } }, [db]);
  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const exec = async () => {
    if (problem || busy) return;
    setBusy(true);
    let res: RenameResult | null = null;
    const ok = await run(async (d) => { res = await renameActor(d, o, n); }, () => (res ? `‘${o}’ → ‘${n}’ 이름을 바꿨어요.` : ""));
    if (ok && res) {
      const r = res as RenameResult;
      setDone(`‘${o}’ → ‘${n}’: 공연 ${r.shows}개 · 회차 ${r.sessions}개에 반영했어요.${r.merged ? ` 같은 배역에 이미 있던 ‘${n}’(${r.merged}곳)은 하나로 합쳤어요.` : ""} 아래 기록에서 되돌릴 수 있어요.`);
      setOldName(""); setNewName("");
    }
    setConfirm(false); setBusy(false); await loadLogs();
  };

  const undo = async (id: string) => {
    if (busy) return;
    setBusy(true);
    let res: UndoResult | null = null;
    const ok = await run(async (d) => { res = await undoActorRename(d, id); }, "이름 변경을 되돌렸어요.");
    if (ok && res) {
      const r = res as UndoResult;
      setDone(`되돌렸어요. 이름 ${r.restored}곳 복원${r.split ? ` · 합쳐졌던 배우 ${r.split}곳 다시 분리` : ""}${r.skipped ? ` · 그 사이 바뀌어서 그대로 둔 ${r.skipped}곳` : ""}.`);
    }
    setUndoId(null); setBusy(false); await loadLogs();
  };

  return (
    <div className="space-y-4" data-testid="actor-rename">
      <Sec title="배우 이름 일괄 변경">
        <p className="mb-3 text-xs leading-relaxed text-mute">
          오타를 고치거나 표기를 바꿀 때 쓰세요. 이름이 같은 배우를 모든 공연(진행 중·개막 예정·종료)과 과거·향후 회차에서 한 번에 바꿔요.
          배우 항목과 회차 연결은 그대로 두고 이름만 바뀌고, 바꾼 뒤에도 아래 변경 기록에서 되돌릴 수 있어요. 이 브라우저들의 관심 배우(하트)도 다음에 접속할 때 새 이름으로 이어져요.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Fld label="① 기존 이름">
            <input value={oldName} onChange={(e) => { setOldName(e.target.value); setConfirm(false); setDone(""); setMsg(""); }} className={inp} placeholder="배우 이름 검색·입력" aria-label="기존 이름" data-testid="old-name" maxLength={50} />
          </Fld>
          <ArrowRight aria-hidden size={18} className="hidden pb-0 text-mute sm:mb-2.5 sm:block" />
          <Fld label="② 새 이름">
            <input value={newName} onChange={(e) => { setNewName(e.target.value); setConfirm(false); setMsg(""); }} className={inp} placeholder="바꿀 이름" aria-label="새 이름" data-testid="new-name" maxLength={50} />
          </Fld>
        </div>

        {!found && (
          <div className="mt-3" data-testid="actor-matches">
            <p className="mb-1 text-xs text-mute">{o ? "비슷한 이름" : "등록된 배우"} — 눌러서 고르세요</p>
            {matches.length === 0
              ? <p className="text-sm text-mute">{stats.length === 0 ? "등록된 배우가 없어요." : "맞는 배우가 없어요."}</p>
              : <ul className="flex flex-wrap gap-1.5">
                  {matches.map((s) => (
                    <li key={s.name}>
                      <button onClick={() => { setOldName(s.name); setConfirm(false); }} data-testid="actor-match"
                        className="min-h-[36px] rounded-full border border-line bg-card px-3 text-sm hover:border-brand">
                        {s.name}<span className="ml-1 text-xs text-mute">공연 {s.shows}·회차 {s.sessions}</span>
                      </button>
                    </li>
                  ))}
                </ul>}
          </div>
        )}

        {preview && (
          <div className="mt-3 rounded-xl border border-line bg-bg p-3 text-sm" data-testid="rename-preview" aria-live="polite">
            <p className="flex flex-wrap items-center gap-1.5 font-bold">
              <span className="rounded bg-card px-2 py-0.5 line-through opacity-70" data-testid="pv-old">{o}</span>
              <ArrowRight size={14} aria-hidden />
              <span className="rounded bg-brand px-2 py-0.5 text-onbrand" data-testid="pv-new">{n || "(새 이름 입력)"}</span>
            </p>
            <p className="mt-2" data-testid="pv-counts">변경 대상: 공연 <b>{preview.shows.length}</b>개 · 배우 항목 <b>{preview.members}</b>개 · 회차 <b>{preview.sessions}</b>개</p>
            <ul className="mt-2 space-y-1 text-xs text-mute" data-testid="pv-shows">
              {preview.shows.map((s) => (
                <li key={s.id}><b className="text-ink">{s.title}</b> · {statusLabel(s, today)} · {s.roles.join(", ")} · 회차 {s.sessions}개</li>
              ))}
            </ul>
            {preview.merges.length > 0 && (
              <p className="mt-2 flex gap-1.5 text-xs" data-testid="pv-merge"><AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0 text-brand" />
                <span>{preview.merges.map((m) => `${m.showTitle} · ${m.role}`).join(", ")} 에는 이미 ‘{n}’이(가) 있어요. 중복이 생기지 않게 하나로 합치고, 회차는 그 배우로 이어져요(되돌리면 다시 나뉘어요).</span></p>
            )}
            {preview.newExists && preview.merges.length === 0 && n && <p className="mt-2 text-xs text-mute" data-testid="pv-exists">다른 공연에 이미 ‘{n}’이(가) 있어요. 이름이 같은 배우로 함께 모아 보여요.</p>}
          </div>
        )}

        {o && problem && found && <p role="alert" className="mt-2 text-sm text-red-600" data-testid="rename-problem">{problem}</p>}

        {!confirm ? (
          <div className="mt-3"><button onClick={() => setConfirm(true)} disabled={!!problem || busy} className={btn} data-testid="rename-start">이름 변경하기</button></div>
        ) : (
          <div className="mt-3 rounded-xl border-2 border-brand bg-card p-3" role="alertdialog" aria-label="이름 변경 확인" data-testid="rename-confirm">
            <p className="font-bold">정말 바꿀까요?</p>
            <p className="mt-1 text-sm">‘{o}’ → ‘{n}’ · 공연 {preview?.shows.length ?? 0}개 · 회차 {preview?.sessions ?? 0}개에 적용돼요.</p>
            <p className="mt-1 text-xs text-mute">DB에 저장된 캐스팅 정보가 실제로 바뀌어요. 바꾼 뒤에도 변경 기록에서 되돌릴 수 있어요.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void exec()} disabled={busy} className={btn} data-testid="rename-confirm-yes">{busy ? "바꾸는 중…" : "변경 실행"}</button>
              <button onClick={() => setConfirm(false)} disabled={busy} className={ghost} data-testid="rename-confirm-no">취소</button>
            </div>
          </div>
        )}

        {done && <p role="status" className="mt-3 rounded-lg bg-bg p-2 text-sm" data-testid="rename-done">{done}</p>}
        {msg && !done && <p role="status" className="mt-2 text-sm text-mute" data-testid="rename-msg">{msg}</p>}
      </Sec>

      <Sec title="변경 기록">
        {logs === undefined && <LoadingInline />}
        {logs === null && <p className="text-sm text-mute" data-testid="log-missing">DB에 0017_actor_rename.sql 이 아직 적용되지 않았어요. Supabase SQL Editor에서 실행하면 이름 변경과 기록이 켜져요.</p>}
        {logs && logs.length === 0 && <p className="text-sm text-mute" data-testid="log-empty">아직 바꾼 기록이 없어요.</p>}
        {logs && logs.length > 0 && (
          <ul className="divide-y divide-line" data-testid="rename-log">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm" data-testid="log-row">
                <span className="min-w-0 font-bold [overflow-wrap:anywhere]">{l.old_name} <ArrowRight size={12} aria-hidden className="inline" /> {l.new_name}</span>
                <span className="text-xs text-mute">{fmt(l.created_at)} · 공연 {l.show_count} · 회차 {l.session_count}</span>
                <span className="ml-auto">
                  {l.undone_at ? <span className="text-xs text-mute" data-testid="log-undone">되돌림 {fmt(l.undone_at)}</span>
                    : undoId === l.id ? (
                      <span className="inline-flex items-center gap-2" data-testid="undo-confirm">
                        <span className="text-xs">되돌릴까요?</span>
                        <button onClick={() => void undo(l.id)} disabled={busy} className={btn} data-testid="undo-yes">되돌리기</button>
                        <button onClick={() => setUndoId(null)} className={ghost}>취소</button>
                      </span>
                    ) : <button onClick={() => setUndoId(l.id)} disabled={busy} className={ghost} data-testid="undo-start"><Undo2 size={14} aria-hidden />되돌리기</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sec>
    </div>
  );
}
