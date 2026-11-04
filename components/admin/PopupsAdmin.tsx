"use client";

import { useState } from "react";
import { useDirty } from "./dirty";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Popup } from "@/types/popup";
import { createPopup, deletePopup, updatePopup, type PopupInput } from "@/lib/db/popups";
import { PHASE_LABEL, isHttpUrl, periodText, phaseOf } from "@/lib/period";
import { Fld, Sec, btn, ghost, iconBtn, inp, useAdminRun } from "./shared";

const GRADIENTS: [string, string][] = [
  ["#3b1d5a,#c2410c", "보라 · 주황"], ["#0f3d3e,#b45309", "청록 · 갈색"], ["#1c2b4a,#8B1E3F", "남색 · 자주"],
  ["#240046,#ff6ec7", "보라 · 분홍"], ["#1b1b1b,#84a98c", "검정 · 연두"],
];
const EMPTY: PopupInput = { title: "", body: "", label: "광고 · 제휴", cta: "자세히 보기", linkUrl: "", imageUrl: "", gradient: GRADIENTS[0][0], startsOn: "", endsOn: "", active: true, sortOrder: 0 };

/** 팝업 광고 여러 개 등록·기간 지정. 홈 첫 진입 때 '켜 둠 + 기간 안'인 것이 한 장씩 넘겨 볼 수 있게 떠요. */
export default function PopupsAdmin({ popups }: { popups: Popup[] }) {
  const { run, msg, setMsg } = useAdminRun();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PopupInput>(EMPTY);
  const [delId, setDelId] = useState<string | null>(null);

  const set = <K extends keyof PopupInput>(k: K, v: PopupInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setEditing(null); setForm(EMPTY); };
  useDirty("popup-form", "팝업 입력", editing === null && JSON.stringify(form) !== JSON.stringify(EMPTY));
  const t = form.title.trim();
  const problem =
    !t || t.length > 60 ? "제목을 1~60자로 입력해 주세요."
    : form.body.trim().length > 300 ? "문구는 300자까지예요."
    : form.startsOn && form.endsOn && form.endsOn < form.startsOn ? "끝나는 날이 시작하는 날보다 빠를 수 없어요."
    : form.linkUrl.trim() && !isHttpUrl(form.linkUrl.trim()) ? "이동 링크는 http:// 또는 https:// 로 시작해야 해요."
    : form.imageUrl.trim() && !isHttpUrl(form.imageUrl.trim()) ? "이미지 주소는 http:// 또는 https:// 로 시작해야 해요."
    : !Number.isInteger(form.sortOrder) || form.sortOrder < -999 || form.sortOrder > 999 ? "순서는 -999~999 사이의 정수예요."
    : "";

  const save = async () => {
    if (problem) { setMsg(problem); return; }
    const ok = await run((db) => (editing ? updatePopup(db, editing, form) : createPopup(db, form)), editing ? "팝업을 수정했어요." : "팝업을 올렸어요.");
    if (ok) reset();
  };
  const edit = (p: Popup) => {
    setEditing(p.id); setMsg("");
    setForm({ title: p.title, body: p.body, label: p.label, cta: p.cta, linkUrl: p.linkUrl, imageUrl: p.imageUrl, gradient: p.gradient, startsOn: p.startsOn, endsOn: p.endsOn, active: p.active, sortOrder: p.sortOrder });
  };
  const [g1, g2] = form.gradient.split(",");

  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">홈 화면에 처음 들어올 때 뜨는 팝업이에요. 여러 개를 올려 두면 한 장씩 넘겨 볼 수 있고, 기간이 지나면 자동으로 안 떠요. 지우지 않고 잠깐 끄고 싶으면 &lsquo;끄기&rsquo;를 누르세요. 이미지는 인터넷 주소(https://…)를 붙여 넣어요. 비우면 색 배경으로 보여요.</p>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      <Sec title={editing ? "팝업 수정" : "새 팝업 만들기"} right={editing && <button onClick={reset} className={ghost}><X size={14} aria-hidden />수정 취소</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld label={`제목 (${t.length}/60)`} className="sm:col-span-2">
            <input value={form.title} maxLength={60} onChange={(e) => set("title", e.target.value)} className={inp} placeholder="예: 열두 번째 편지" />
          </Fld>
          <Fld label={`문구 (${form.body.trim().length}/300, 줄바꿈 가능)`} className="sm:col-span-2">
            <textarea value={form.body} maxLength={300} rows={3} onChange={(e) => set("body", e.target.value)} className={inp} />
          </Fld>
          <Fld label="왼쪽 위 표시"><input value={form.label} maxLength={40} onChange={(e) => set("label", e.target.value)} className={inp} placeholder="광고 · 제휴" /></Fld>
          <Fld label="버튼 글자"><input value={form.cta} maxLength={20} onChange={(e) => set("cta", e.target.value)} className={inp} /></Fld>
          <Fld label="이동 링크 (선택, 비우면 버튼 없음)" className="sm:col-span-2">
            <input value={form.linkUrl} maxLength={500} onChange={(e) => set("linkUrl", e.target.value)} className={inp} placeholder="https://..." inputMode="url" />
          </Fld>
          <Fld label="이미지 주소 (선택)" className="sm:col-span-2">
            <input value={form.imageUrl} maxLength={500} onChange={(e) => set("imageUrl", e.target.value)} className={inp} placeholder="https://.../poster.jpg" inputMode="url" />
          </Fld>
          <Fld label="배경색 (이미지가 없을 때)">
            <select value={form.gradient} onChange={(e) => set("gradient", e.target.value)} className={inp}>
              {GRADIENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Fld>
          <Fld label="순서 (작은 번호가 먼저)"><input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Math.trunc(Number(e.target.value) || 0))} className={inp} /></Fld>
          <Fld label="보이기 시작하는 날 (비우면 바로)"><input type="date" value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} className={inp} /></Fld>
          <Fld label="끝나는 날 (비우면 계속)"><input type="date" value={form.endsOn} onChange={(e) => set("endsOn", e.target.value)} className={inp} /></Fld>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />켜 두기 (끄면 기간 안이어도 안 떠요)
        </label>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-12 w-10 shrink-0 rounded-md border border-line" style={{ backgroundImage: `linear-gradient(160deg, ${g1}, ${g2})` }} aria-label="배경색 미리보기" />
          <button onClick={save} className={btn} disabled={!!problem}><Plus size={14} aria-hidden />{editing ? "수정 저장" : "팝업 올리기"}</button>
        </div>
        {problem && form.title && <p className="mt-2 text-xs text-mute">{problem}</p>}
      </Sec>

      <Sec title={`올린 팝업 ${popups.length}개`}>
        {popups.length === 0 ? <p className="text-sm text-mute">아직 올린 팝업이 없어요. 팝업을 올리기 전에는 홈에 팝업이 뜨지 않아요.</p> : (
          <ul className="space-y-2">
            {popups.map((p) => {
              const ph = phaseOf(p);
              const live = p.active && ph === "active";
              return (
                <li key={p.id} className="flex items-start gap-2 rounded-xl border border-line bg-bg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
                      <span className={`rounded-full border px-2 py-0.5 font-medium ${live ? "border-brand text-brand" : "border-line"}`}>{!p.active ? "꺼짐" : PHASE_LABEL[ph]}</span>
                      <span className="tabular-nums">{periodText(p)}</span>
                      <span>순서 {p.sortOrder}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-bold">{p.title}</div>
                  </div>
                  {delId === p.id ? (
                    <>
                      <button onClick={() => run((db) => deletePopup(db, p.id), "팝업을 삭제했어요.").then(() => setDelId(null))} className={btn}>삭제 확인</button>
                      <button onClick={() => setDelId(null)} className={ghost}>취소</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => run((db) => updatePopup(db, p.id, { ...p, linkUrl: p.linkUrl, imageUrl: p.imageUrl, active: !p.active }), p.active ? "팝업을 껐어요." : "팝업을 켰어요.")}
                        aria-label={`${p.title} ${p.active ? "끄기" : "켜기"}`} className={iconBtn}>{p.active ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}</button>
                      <button onClick={() => edit(p)} aria-label={`${p.title} 수정`} className={iconBtn}><Pencil size={14} aria-hidden /></button>
                      <button onClick={() => setDelId(p.id)} aria-label={`${p.title} 삭제`} className={iconBtn}><Trash2 size={14} aria-hidden /></button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sec>
    </div>
  );
}
