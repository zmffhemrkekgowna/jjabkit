"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Genre, Show } from "@/types/show";
import { dateProblem, statusOf } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import { StatusTag } from "../ui/Tags";
import { updateShow, uploadPoster } from "@/lib/db/shows";
import Poster from "../ui/Poster";
import { Fld, PALETTES, Sec, TextInput, inp, type Run } from "./shared";
import SlotCard from "../casting/SlotCard";
import { SHOW_COLORS, isHex6, readableText } from "@/lib/color";
import { showColor } from "@/lib/mySchedule";

/** 입력값을 '#rrggbb'로 정리해요. '#'은 없어도 되고 3자리(#f80)도 받아요. 형식이 틀리면 빈 문자열이에요. */
const normHex = (v: string) => {
  const t = v.trim().replace(/^#/, "");
  const six = /^[0-9a-fA-F]{3}$/.test(t) ? t.split("").map((c) => c + c).join("") : t;
  return /^[0-9a-fA-F]{6}$/.test(six) ? `#${six.toLowerCase()}` : "";
};

/** 공연별 스케줄 색. 팔레트·색상 선택기·HEX 입력 중 편한 걸로 고르면 바로 저장돼요. 이 색이 달력의 이 공연 회차 카드 전체에 쓰여요. */
function ScheduleColor({ show, upd }: { show: Show; upd: (patch: { color: string }, msg?: string) => unknown }) {
  const saved = show.color ?? "";
  const eff = showColor(show); // 저장된 색이 없으면 포스터 색이 대신 쓰여요
  const [draft, setDraft] = useState(eff);
  const [text, setText] = useState(saved);
  const [bad, setBad] = useState(false);
  const last = useRef(""); // 방금 저장 요청한 색(같은 색을 두 번 저장하지 않으려고)
  useEffect(() => { last.current = ""; setDraft(showColor(show)); setText(show.color ?? ""); setBad(false); }, [show.color, show.grad]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (hex: string) => { setBad(false); setDraft(hex); setText(hex); if (hex.toLowerCase() !== saved.toLowerCase() && hex.toLowerCase() !== last.current) { last.current = hex.toLowerCase(); upd({ color: hex }, "스케줄 색을 저장했어요."); } };
  // 색상 선택기는 드래그하는 동안 값이 계속 바뀌므로, 멈춘 뒤(0.6초)에 한 번만 저장해요.
  useEffect(() => {
    if (!isHex6(draft) || draft.toLowerCase() === (saved || eff).toLowerCase() || draft.toLowerCase() === last.current) return;
    const t = setTimeout(() => commit(draft), 600);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = isHex6(draft) ? draft : eff;
  return (
    <div className="mt-3 rounded-xl bg-bg p-3" role="group" aria-label="스케줄 색상">
      <p className="text-sm font-medium">스케줄 색상 <span className="text-xs font-normal text-mute">달력에서 이 공연의 회차 카드에 쓰여요</span></p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {SHOW_COLORS.map((c) => (
          <button key={c.hex} onClick={() => commit(c.hex)} aria-label={`스케줄 색 ${c.name}`} aria-pressed={saved.toLowerCase() === c.hex} title={c.name}
            className={`h-8 w-8 rounded-full border-2 ${saved.toLowerCase() === c.hex ? "border-ink ring-2 ring-[var(--brand)]" : "border-line"}`} style={{ background: c.hex }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="color" value={preview} onChange={(e) => setDraft(e.target.value)} aria-label="스케줄 색상 선택기" className="h-9 w-12 cursor-pointer rounded border border-line bg-card p-0.5" />
        <label className="flex items-center gap-1 text-xs text-mute">HEX
          <input value={text} onChange={(e) => { setText(e.target.value); setBad(false); }} aria-label="스케줄 색 HEX 코드" aria-invalid={bad} placeholder="#ea580c" maxLength={7}
            onBlur={() => { const h = normHex(text); if (!text.trim()) return; if (h) commit(h); else setBad(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className={`${inp} !w-28 font-mono ${bad ? "border-brand" : ""}`} />
        </label>
        {saved && <button onClick={() => { setDraft(showColor({ grad: show.grad })); setText(""); upd({ color: "" }, "스케줄 색을 포스터 색으로 되돌렸어요."); }} className="text-xs text-mute underline">포스터 색으로 되돌리기</button>}
        <div className="w-28" aria-label="미리보기">
          <SlotCard as="span" color={preview} time="19:30" all={["홍길동", "김철수", "이영희"]} />
        </div>
      </div>
      {bad && <p role="alert" className="mt-1 text-xs font-medium text-brand">색 코드는 #ea580c 같은 6자리 HEX로 입력해 주세요.</p>}
      <p className="mt-1 text-xs text-mute">{saved ? `선택한 색 ${saved}` : "아직 고르지 않았어요. 지금은 포스터 색이 쓰여요."} · 글자색은 배경에 맞춰 자동으로 정해져요({readableText(preview) === "#ffffff" ? "흰색" : "어두운색"}).</p>
    </div>
  );
}

export default function ShowForm({ show, run }: { show: Show; run: Run }) {
  const upd = (patch: Parameters<typeof updateShow>[2], msg?: string) => run((db) => updateShow(db, show.id, patch), msg);
  // 상태는 직접 고르지 않아요. 개막일·종료일로 자동 계산돼서, 날짜를 바꾸면 바로 다시 계산돼요.
  const today = useTodayKST();
  const [dateErr, setDateErr] = useState("");
  const setDate = (field: "start" | "end", v: string) => {
    const next = { start: show.start, end: show.end, [field]: v };
    // 둘 다 채워졌는데 순서가 어긋나면 저장하지 않아요(잘못된 날짜로 상태를 짐작하지 않기 위해).
    if (next.start && next.end && dateProblem(next.start, next.end)) {
      setDateErr(field === "start" ? "개막일이 종료일보다 늦을 수 없어요. 일정을 뒤로 옮길 때는 종료일을 먼저 바꾼 뒤 개막일을 바꿔 주세요." : "종료일이 개막일보다 빠를 수 없어요. 일정을 앞으로 옮길 때는 개막일을 먼저 바꾼 뒤 종료일을 바꿔 주세요.");
      return;
    }
    setDateErr("");
    upd({ [field]: v });
  };
  const problem = dateErr || dateProblem(show.start, show.end);
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    run(async (db) => { const url = await uploadPoster(db, show.id, f); await updateShow(db, show.id, { img: url }); }, "포스터를 올렸어요.");
  };

  return (
    <Sec title="공연 기본 정보">
      <div className="flex gap-3">
        <Poster show={show} className="h-32 w-24 shrink-0 rounded-xl text-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <Fld label="포스터 이미지 URL">
            <TextInput value={show.img} onCommit={(v) => upd({ img: v.trim() })} placeholder="https://..." className={inp} />
          </Fld>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*" onChange={onFile} aria-label="포스터 파일 올리기" className="min-w-0 max-w-full text-xs" />
            {show.img && <button onClick={() => upd({ img: "" })} className="text-xs text-mute underline">이미지 제거</button>}
          </div>
          <div className="flex gap-2" role="group" aria-label="포스터 색상">
            {PALETTES.map((g) => (
              <button key={g} aria-label="포스터 색상 선택" aria-pressed={show.grad === g} onClick={() => upd({ grad: g })}
                className={`h-7 w-7 rounded-full border-2 ${show.grad === g ? "border-brand" : "border-line"}`} style={{ background: `linear-gradient(160deg,${g})` }} />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-mute">파일을 고르면 Supabase 저장소(posters)에 올라가요. 이미지가 없으면 기본 포스터가 보여요.</p>
      <ScheduleColor show={show} upd={upd} />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Fld label="공연명" className="sm:col-span-2"><TextInput value={show.title} onCommit={(v) => upd({ title: v })} className={inp} /></Fld>
        <Fld label="장르">
          <select value={show.genre} onChange={(e) => upd({ genre: e.target.value as Genre })} className={inp}><option value="뮤지컬">뮤지컬</option><option value="연극">연극</option></select>
        </Fld>
        <Fld label="극장"><TextInput value={show.venue} onCommit={(v) => upd({ venue: v })} className={inp} /></Fld>
        <Fld label="지역"><TextInput value={show.region} onCommit={(v) => upd({ region: v })} className={inp} /></Fld>
        <Fld label="개막일"><input type="date" value={show.start} onChange={(e) => setDate("start", e.target.value)} max={show.end || undefined} aria-invalid={!!problem} className={inp} /></Fld>
        <Fld label="종료일"><input type="date" value={show.end} onChange={(e) => setDate("end", e.target.value)} min={show.start || undefined} aria-invalid={!!problem} className={inp} /></Fld>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-bg p-3 sm:col-span-2" aria-live="polite">
          <span className="text-sm font-medium">공연 상태</span>
          <StatusTag status={statusOf(show, today)} />
          <span className="text-xs text-mute">개막일·종료일에 맞춰 자동으로 정해져요(종료일 당일까지 공연 중, 한국 시간 기준). 직접 바꿀 필요가 없어요.</span>
          {problem && <p role="alert" className="w-full text-sm font-medium text-brand">{problem}</p>}
        </div>
        <Fld label="관람 등급"><TextInput value={show.age} onCommit={(v) => upd({ age: v })} placeholder="만 12세 이상" className={inp} /></Fld>
        <Fld label="러닝타임"><TextInput value={show.run} onCommit={(v) => upd({ run: v })} placeholder="약 150분(인터미션 포함)" className={inp} /></Fld>
        <Fld label="조기예매 안내 문구" className="sm:col-span-2"><TextInput value={show.eb} onCommit={(v) => upd({ eb: v })} placeholder="~ 2026.10.31(토)까지" className={inp} /></Fld>
      </div>
    </Sec>
  );
}
