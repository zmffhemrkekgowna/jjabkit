"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { createEvent, deleteEvent, restoreEvents, updateEvent, type EventInput } from "@/lib/db/events";
import { useDirty } from "./dirty";
import { EVENT_COLORS, isHex6, readableOn } from "@/lib/color";
import { PHASE_LABEL, isHttpUrl, isRealDate, linkProblem, phaseOf } from "@/lib/period";
import { derivedPeriod, keyDate, keyTime, scopeText, sessionKey, SCOPE_LABEL } from "@/lib/eventScope";
import { fmtDate, fromKey } from "@/lib/casting";
import type { EventScope } from "@/types/event";
import { Fld, Sec, btn, ghost, iconBtn, inp, showToast, type Run } from "./shared";

const EMPTY: EventInput = { title: "", startsOn: "", endsOn: "", linkUrl: "", color: "", scope: "all", sessionKeys: [] };
const SCOPES: EventScope[] = ["all", "range", "sessions"];
const SCOPE_HELP: Record<EventScope, string> = { all: "이 공연의 모든 회차에 적용돼요. 날짜를 고를 필요가 없어요.", range: "시작일~종료일 사이에 있는 모든 회차에 적용돼요.", sessions: "아래 목록에서 고른 날짜·시간의 회차에만 적용돼요." };

/**
 * 한 공연의 이벤트 관리. 이벤트는 여기서만 만들어요.
 * '이벤트 있음'을 체크해야 입력 영역이 보여요. 끄면 입력 영역만 숨기고 저장된 이벤트는 그대로 둬요.
 */
export default function ShowEventsEditor({ show, events, run }: { show: Show; events: EventItem[]; run: Run }) {
  const [on, setOn] = useState<boolean | null>(null); // null이면 이벤트가 있는지(데이터)를 따라요
  const checked = on ?? events.length > 0;
    const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [delId, setDelId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => { setErr(""); setForm((f) => ({ ...f, [k]: v })); };
  const reset = () => { setEditing(null); setForm(EMPTY); setErr(""); setTouched(false); };
  useDirty(`event-form-${show.id}`, "이벤트 입력", editing === null && JSON.stringify(form) !== JSON.stringify(EMPTY));
  const scope: EventScope = form.scope ?? "all";
  const keys = form.sessionKeys ?? [];
  // 이 공연의 등록된 회차를 날짜별로 묶어요(키는 날짜+시간).
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of show.sessions) { const k = sessionKey(x.date, x.time); m.set(x.date, [...new Set([...(m.get(x.date) ?? []), k])].sort()); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [show.sessions]);
  const allKeys = useMemo(() => new Set(groups.flatMap(([, ks]) => ks)), [groups]);
  const stale = keys.filter((k) => !allKeys.has(k));
  const setKeys = (next: string[]) => set("sessionKeys", [...new Set(next)].sort());
  const toggleKey = (k: string) => setKeys(keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k]);
  const toggleDate = (ks: string[]) => setKeys(ks.every((k) => keys.includes(k)) ? keys.filter((k) => !ks.includes(k)) : [...keys, ...ks]);
  const t = form.title.trim();
  // 칸마다 따로 검사해서 어느 칸이 문제인지 그 칸 아래에 바로 보여줘요.
  const fieldErr = {
    title: !t ? "제목을 입력해 주세요." : t.length > 100 ? "제목은 100자 이내로 입력해 주세요." : "",
    startsOn: scope !== "range" ? "" : !form.startsOn ? "시작하는 날을 골라 주세요." : !isRealDate(form.startsOn) ? "존재하지 않는 날짜예요." : "",
    endsOn: scope !== "range" ? "" : form.endsOn && !isRealDate(form.endsOn) ? "존재하지 않는 날짜예요."
      : form.endsOn && form.startsOn && form.endsOn < form.startsOn ? "끝나는 날이 시작하는 날보다 빠를 수 없어요." : "",
    linkUrl: linkProblem(form.linkUrl),
    color: form.color && !isHex6(form.color) ? "막대 색은 #rrggbb 형식이어야 해요." : "",
    sessions: scope === "sessions" && keys.length === 0 ? "적용할 회차를 하나 이상 골라 주세요." : scope === "sessions" && groups.length === 0 ? "이 공연에 등록된 회차가 없어요. 먼저 공연 일정을 등록해 주세요." : "",
  };
  const [touched, setTouched] = useState(false); // 저장을 한 번 눌러 본 뒤부터 빈 칸 안내를 보여줘요
  const shown = (k: keyof typeof fieldErr) => (touched || (k !== "title" && k !== "startsOn" && k !== "sessions" && form[k as keyof EventInput])) ? fieldErr[k] : "";
  const problem = fieldErr.title || fieldErr.startsOn || fieldErr.endsOn || fieldErr.linkUrl || fieldErr.color || fieldErr.sessions;

  // 체크 해제는 입력 영역을 숨기기만 해요. 저장된 이벤트는 지우지 않아요(삭제는 각 이벤트의 삭제 버튼으로만).
  const toggle = (v: boolean) => { setOn(v); if (!v) { reset(); setDelId(null); } };
  const save = async () => {
    if (problem) { setTouched(true); setErr(problem); showToast(problem, "error"); return; }
    const prev = events.find((x) => x.id === editing);
    // 전체·회차 방식은 날짜를 따로 받지 않고, 공연 일정에서 시작·끝 날짜를 채워 저장해요(예전 화면과 맞추기 위해).
    const payload: EventInput = scope === "range"
      ? { ...form, scope, sessionKeys: [] }
      : { ...form, scope, sessionKeys: scope === "sessions" ? keys : [], ...derivedPeriod(scope, groups.map(([d]) => d), keys) };
    const ok = await run(
      (db) => (editing ? updateEvent(db, editing, payload, !!prev?.color, !!prev && prev.scope !== "range") : createEvent(db, show.id, payload)),
      editing ? "이벤트가 수정되었습니다." : "이벤트가 추가되었습니다.",
    );
    if (ok) reset();
  };
  const edit = (e: EventItem) => { setEditing(e.id); setErr(""); setForm({ title: e.title, startsOn: e.startsOn, endsOn: e.endsOn, linkUrl: e.linkUrl, color: e.color, scope: e.scope, sessionKeys: e.sessionKeys }); };

  const live = events.filter((e) => phaseOf(e) === "active").length;

  return (
    <Sec title="이벤트" right={<span className="text-xs text-mute">{events.length ? `${events.length}개 · 진행 중 ${live}개${checked ? "" : " (숨김)"}` : checked ? "아직 없음" : "이벤트 없음"}</span>}>
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        이 공연에 이벤트 있음
      </label>
      {!checked && events.length === 0 && <p className="mt-2 text-xs text-mute">체크하면 이벤트(제목, 시작·끝나는 날, 공지 링크)를 등록할 수 있어요. 이벤트는 이 공연의 캐스팅 달력에 기간만큼 이어진 막대로 보여요.</p>}

      {!checked && events.length > 0 && (
        <p role="note" className="mt-2 rounded-lg border border-line bg-bg p-2 text-xs text-mute">이벤트 {events.length}개가 저장돼 있어요. 입력 영역만 숨겼고 삭제되지 않았어요. 다시 체크하면 그대로 보여요. (삭제는 이벤트별 삭제 버튼으로만 돼요)</p>
      )}

      {checked && (
        <div className="mt-4 space-y-4">
          {events.length > 0 && (
            <ul className="space-y-2" aria-label={`${show.title} 이벤트 목록`}>
              {events.map((e) => {
                const ph = phaseOf(e);
                return (
                  <li key={e.id} className="flex items-start gap-2 rounded-xl border border-line bg-bg p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-mute">
                        <span className={`rounded-full border px-2 py-0.5 font-medium ${ph === "active" ? "border-brand text-brand" : "border-line"}`}>{PHASE_LABEL[ph]}</span>
                        <span className="rounded-full border border-line px-2 py-0.5" data-scope-badge>{SCOPE_LABEL[e.scope]}</span>
                        <span className="tabular-nums">{scopeText(e)}</span>
                        {isHex6(e.color) && <span aria-label={`막대 색 ${e.color}`} className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: e.color }} />}
                      </div>
                      <div className="mt-1 truncate text-sm font-bold">{e.title}</div>
                      {isHttpUrl(e.linkUrl) && <a href={e.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand underline"><ExternalLink size={11} aria-hidden />공지 링크</a>}
                    </div>
                    {delId === e.id ? (
                      <>
                        <button onClick={() => run((db) => deleteEvent(db, e.id), "이벤트가 삭제되었습니다.", () => run((db) => restoreEvents(db, [e]), "삭제한 이벤트를 되살렸어요.")).then(() => setDelId(null))} className={btn}>삭제 확인</button>
                        <button onClick={() => setDelId(null)} className={ghost}>취소</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => edit(e)} aria-label={`${e.title} 수정`} className={iconBtn}><Pencil size={14} aria-hidden /></button>
                        <button onClick={() => setDelId(e.id)} aria-label={`${e.title} 삭제`} className={iconBtn}><Trash2 size={14} aria-hidden /></button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{editing ? "이벤트 수정" : "이벤트 추가"}</p>
              {editing && <button onClick={reset} className={ghost}><X size={14} aria-hidden />수정 취소</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fld label={`제목 (${t.length}/100)`} className="sm:col-span-2">
                <input value={form.title} maxLength={100} onChange={(e) => set("title", e.target.value)} className={inp} placeholder="예: 커튼콜 데이 포토카드 증정" aria-invalid={!!shown("title")} />
                {shown("title") && <p role="alert" className="mt-1 text-xs text-red-600">{shown("title")}</p>}
              </Fld>
              <fieldset className="sm:col-span-2">
                <legend className="text-xs font-medium text-mute">이벤트 적용 범위</legend>
                <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="이벤트 적용 범위">
                  {SCOPES.map((sc) => (
                    <label key={sc} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm ${scope === sc ? "border-brand bg-hit font-bold text-brand" : "border-line text-mute"}`}>
                      <input type="radio" name={`scope-${show.id}`} value={sc} checked={scope === sc} onChange={() => set("scope", sc)} className="sr-only" />
                      {SCOPE_LABEL[sc]}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-mute">{SCOPE_HELP[scope]}</p>
              </fieldset>
              {scope === "sessions" && (
                <div className="sm:col-span-2" data-session-picker>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-mute" aria-live="polite">선택한 회차 {keys.filter((k) => allKeys.has(k)).length}개 / 전체 {allKeys.size}개</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setKeys([...allKeys])} className={ghost}>전체 선택</button>
                      <button type="button" onClick={() => setKeys([])} className={ghost}>선택 해제</button>
                    </div>
                  </div>
                  {groups.length === 0 ? <p className="mt-2 text-xs text-mute">이 공연에 등록된 회차가 없어요. 먼저 공연 일정을 등록해 주세요.</p> : (
                    <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-line p-2" aria-label="이벤트 적용 회차 선택">
                      {groups.map(([d, ks]) => {
                        const all = ks.every((k) => keys.includes(k));
                        return (
                          <li key={d} className="rounded-lg bg-bg p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold">{d.slice(0, 4)}년 {fmtDate(fromKey(d))}</span>
                              <button type="button" onClick={() => toggleDate(ks)} aria-pressed={all} aria-label={`${d} 전체 선택`} className="min-h-[36px] rounded-full border border-line px-3 text-xs text-mute aria-pressed:border-brand aria-pressed:text-brand">{all ? "날짜 해제" : "날짜 전체 선택"}</button>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {ks.map((k) => (
                                <label key={k} className={`inline-flex min-h-[44px] min-w-[96px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm tabular-nums ${keys.includes(k) ? "border-brand bg-hit font-bold text-brand" : "border-line"}`}>
                                  <input type="checkbox" checked={keys.includes(k)} onChange={() => toggleKey(k)} className="h-4 w-4 accent-[var(--brand)]" aria-label={`${d} ${keyTime(k)}`} />
                                  {keyTime(k)}
                                </label>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {stale.length > 0 && (
                    <p role="note" className="mt-2 rounded-lg border border-line bg-bg p-2 text-xs text-mute" data-stale>
                      현재 일정에 없는 회차 {stale.length}개({stale.map((k) => `${keyDate(k).slice(5).replace("-", "/")} ${keyTime(k)}`).join(", ")})가 선택돼 있어요. 저장하면 그대로 남아요.
                      <button type="button" onClick={() => setKeys(keys.filter((k) => allKeys.has(k)))} className="ml-1 underline">없는 회차 빼기</button>
                    </p>
                  )}
                  {shown("sessions") && <p role="alert" className="mt-1 text-xs text-red-600">{shown("sessions")}</p>}
                </div>
              )}
              {scope === "range" && <>
              <Fld label="시작하는 날"><input type="date" value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} className={inp} aria-invalid={!!shown("startsOn")} />
                {shown("startsOn") && <p role="alert" className="mt-1 text-xs text-red-600">{shown("startsOn")}</p>}</Fld>
              <Fld label="끝나는 날 (비우면 하루만)"><input type="date" value={form.endsOn} min={isRealDate(form.startsOn) ? form.startsOn : undefined} onChange={(e) => set("endsOn", e.target.value)} className={inp} aria-invalid={!!shown("endsOn")} />
                {shown("endsOn") && <p role="alert" className="mt-1 text-xs text-red-600">{shown("endsOn")}</p>}</Fld>
              </>}
              <Fld label="공지 링크 (선택)" className="sm:col-span-2">
                <input value={form.linkUrl} maxLength={500} onChange={(e) => set("linkUrl", e.target.value)} className={inp} placeholder="https://..." inputMode="url" aria-invalid={!!shown("linkUrl")} />
                {shown("linkUrl") && <p role="alert" className="mt-1 text-xs text-red-600">{shown("linkUrl")}</p>}
              </Fld>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-mute">달력 막대 색 (선택)</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => set("color", "")} aria-pressed={!form.color} aria-label="기본색"
                    className={`rounded-full border px-3 py-2 text-xs sm:py-1 ${!form.color ? "border-brand bg-hit font-bold text-brand" : "border-line text-mute"}`}>기본</button>
                  {EVENT_COLORS.map((c) => (
                    <button key={c.hex} type="button" onClick={() => set("color", c.hex)} aria-label={`막대 색 ${c.name}`} aria-pressed={form.color.toLowerCase() === c.hex}
                      style={{ background: c.hex }} className={`h-9 w-9 sm:h-7 sm:w-7 rounded-full border-2 ${form.color.toLowerCase() === c.hex ? "border-ink ring-2 ring-[var(--brand)]" : "border-line"}`} />
                  ))}
                  <label className="inline-flex items-center gap-1 text-xs text-mute">직접 고르기
                    <input type="color" aria-label="막대 색 직접 고르기" value={isHex6(form.color) ? form.color : "#2563eb"} onChange={(e) => set("color", e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-card p-0.5" />
                  </label>
                </div>
                <div className="mt-2 flex h-6 items-center overflow-hidden rounded-md px-2 text-xs font-bold" data-preview
                  style={isHex6(form.color) ? { background: form.color, color: readableOn(form.color) } : undefined}>
                  <span className={`truncate ${isHex6(form.color) ? "" : "rounded-md bg-ink px-2 text-bg"}`}>{t || "이벤트 제목"}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={save} className={btn}><Plus size={14} aria-hidden />{editing ? "수정 저장" : "이벤트 추가"}</button>
              {touched && problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
            </div>
          </div>
        </div>
      )}
    </Sec>
  );
}
