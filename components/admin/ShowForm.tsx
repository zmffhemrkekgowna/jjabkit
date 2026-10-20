"use client";

import type { ChangeEvent } from "react";
import type { Genre, Show, Status } from "@/types/show";
import { updateShow, uploadPoster } from "@/lib/db/shows";
import Poster from "../ui/Poster";
import { Fld, PALETTES, Sec, TextInput, inp, type Run } from "./shared";

export default function ShowForm({ show, run }: { show: Show; run: Run }) {
  const upd = (patch: Parameters<typeof updateShow>[2], msg?: string) => run((db) => updateShow(db, show.id, patch), msg);
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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Fld label="공연명" className="sm:col-span-2"><TextInput value={show.title} onCommit={(v) => upd({ title: v })} className={inp} /></Fld>
        <Fld label="장르">
          <select value={show.genre} onChange={(e) => upd({ genre: e.target.value as Genre })} className={inp}><option value="뮤지컬">뮤지컬</option><option value="연극">연극</option></select>
        </Fld>
        <Fld label="상태">
          <select value={show.status} onChange={(e) => upd({ status: e.target.value as Status })} className={inp}><option value="running">공연 중</option><option value="upcoming">개막 예정</option></select>
        </Fld>
        <Fld label="극장"><TextInput value={show.venue} onCommit={(v) => upd({ venue: v })} className={inp} /></Fld>
        <Fld label="지역"><TextInput value={show.region} onCommit={(v) => upd({ region: v })} className={inp} /></Fld>
        <Fld label="시작일"><input type="date" value={show.start} onChange={(e) => upd({ start: e.target.value })} className={inp} /></Fld>
        <Fld label="종료일"><input type="date" value={show.end} onChange={(e) => upd({ end: e.target.value })} className={inp} /></Fld>
        <Fld label="관람 등급"><TextInput value={show.age} onCommit={(v) => upd({ age: v })} placeholder="만 12세 이상" className={inp} /></Fld>
        <Fld label="러닝타임"><TextInput value={show.run} onCommit={(v) => upd({ run: v })} placeholder="약 150분(인터미션 포함)" className={inp} /></Fld>
        <Fld label="조기예매 안내 문구" className="sm:col-span-2"><TextInput value={show.eb} onCommit={(v) => upd({ eb: v })} placeholder="~ 2026.10.31(토)까지" className={inp} /></Fld>
      </div>
    </Sec>
  );
}
