"use client";

import { useEffect, useState } from "react";
import { Pencil, Pin, Plus, Trash2, X } from "lucide-react";
import type { Show } from "@/types/show";
import { KINDS, KIND_LABEL, type Notice, type NoticeKind } from "@/types/notice";
import { createNotice, deleteNotice, updateNotice, type NoticeInput } from "@/lib/db/notices";
import { fmtNoticeDate } from "@/lib/notices";
import { Fld, Sec, btn, ghost, iconBtn, inp, useAdminRun } from "./shared";

const EMPTY: NoticeInput = { kind: "notice", title: "", body: "", showId: "", pinned: false };

export interface NoticeDraft extends Partial<NoticeInput> { nonce: number }

/** 소식·공지 등록/수정/삭제. 사용자 화면 상단의 종 아이콘 모달에 그대로 나와요. */
export default function NoticesAdmin({ notices, shows, draft }: { notices: Notice[]; shows: Show[]; draft: NoticeDraft | null }) {
  const { run, msg, setMsg } = useAdminRun();
  const [editing, setEditing] = useState<string | null>(null); // null = 새로 쓰기
  const [form, setForm] = useState<NoticeInput>(EMPTY);
  const [delId, setDelId] = useState<string | null>(null);

  // '이 공연 소식 쓰기'로 넘어온 초안을 폼에 채워요
  useEffect(() => {
    if (draft) { setEditing(null); setForm({ ...EMPTY, ...draft }); setMsg(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.nonce]);

  const set = <K extends keyof NoticeInput>(k: K, v: NoticeInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setEditing(null); setForm(EMPTY); };
  const valid = form.title.trim().length > 0 && form.title.trim().length <= 100 && form.body.trim().length <= 2000;

  const save = async () => {
    if (!valid) { setMsg("제목을 1~100자로 입력해 주세요. (본문은 2000자까지)"); return; }
    const ok = await run((db) => (editing ? updateNotice(db, editing, form) : createNotice(db, form)), editing ? "소식을 수정했어요." : "소식을 올렸어요.");
    if (ok) reset();
  };
  const edit = (n: Notice) => { setEditing(n.id); setForm({ kind: n.kind, title: n.title, body: n.body, showId: n.showId, pinned: n.pinned }); setMsg(""); };

  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">신규 공연을 올리거나 캐스팅·일정이 바뀌면 여기에 소식을 남겨요. 방문자 화면 상단 종 아이콘에 N 배지로 표시돼요. 본문은 글자 그대로 보여요.</p>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      <Sec title={editing ? "소식 수정" : "새 소식 쓰기"} right={editing && <button onClick={reset} className={ghost}><X size={14} aria-hidden />수정 취소</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label="종류">
            <select value={form.kind} onChange={(e) => set("kind", e.target.value as NoticeKind)} className={inp}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Fld>
          <Fld label="연결할 공연 (선택)">
            <select value={form.showId} onChange={(e) => set("showId", e.target.value)} className={inp}>
              <option value="">연결 안 함</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.title || "(제목 없음)"}</option>)}
            </select>
          </Fld>
          <Fld label={`제목 (${form.title.trim().length}/100)`} className="sm:col-span-2">
            <input value={form.title} maxLength={100} onChange={(e) => set("title", e.target.value)} className={inp} placeholder="예: 위키드 11월 캐스팅 일정이 바뀌었어요" />
          </Fld>
          <Fld label={`내용 (${form.body.trim().length}/2000)`} className="sm:col-span-2">
            <textarea value={form.body} maxLength={2000} rows={4} onChange={(e) => set("body", e.target.value)} className={inp} />
          </Fld>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.pinned} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4" />목록 맨 위에 고정
        </label>
        <div className="mt-3"><button onClick={save} className={btn} disabled={!valid}><Plus size={14} aria-hidden />{editing ? "수정 저장" : "소식 올리기"}</button></div>
      </Sec>

      <Sec title={`올린 소식 ${notices.length}개`}>
        {notices.length === 0 ? <p className="text-sm text-mute">아직 올린 소식이 없어요.</p> : (
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="flex items-start gap-2 rounded-xl border border-line bg-bg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
                    <span className="rounded-full border border-brand px-2 py-0.5 font-medium text-brand">{KIND_LABEL[n.kind]}</span>
                    {n.pinned && <span className="inline-flex items-center gap-0.5"><Pin size={11} aria-hidden />고정</span>}
                    <span className="tabular-nums">{fmtNoticeDate(n.createdAt)}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-bold">{n.title}</div>
                </div>
                {delId === n.id ? (
                  <>
                    <button onClick={() => run((db) => deleteNotice(db, n.id), "소식을 삭제했어요.").then(() => setDelId(null))} className={btn}>삭제 확인</button>
                    <button onClick={() => setDelId(null)} className={ghost}>취소</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => edit(n)} aria-label={`${n.title} 수정`} className={iconBtn}><Pencil size={14} aria-hidden /></button>
                    <button onClick={() => setDelId(n.id)} aria-label={`${n.title} 삭제`} className={iconBtn}><Trash2 size={14} aria-hidden /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sec>
    </div>
  );
}
