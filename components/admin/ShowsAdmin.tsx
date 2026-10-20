"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Eye, Plus, Trash2 } from "lucide-react";
import type { Show } from "@/types/show";
import { createShow, deleteShow } from "@/lib/db/shows";
import { btn, ghost, useAdminRun } from "./shared";
import ShowForm from "./ShowForm";
import RolesEditor from "./RolesEditor";
import SessionsEditor from "./SessionsEditor";

export default function ShowsAdmin({ shows, onWriteNotice }: { shows: Show[]; onWriteNotice: (show: Show) => void }) {
  const [aid, setAid] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const { run, msg, setMsg } = useAdminRun();
  const show = shows.find((s) => s.id === aid) ?? shows[0];
  const pick = (id: string | null) => { setAid(id); setMsg(""); setAsk(false); };
  const addShow = () => run(async (c) => { pick(await createShow(c)); }, "새 공연을 만들었어요. 아래에서 정보를 채워 주세요.");

  if (!show) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-sm text-mute">등록된 공연이 없어요.</p>
        <button onClick={addShow} className={btn}>새 공연 추가</button>
        <p aria-live="polite" className="mt-3 text-sm text-brand">{msg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">여기서 고친 내용은 DB에 저장되고, 사용자 화면(목록·달력)에 바로 반영돼요. 관리자 계정만 저장할 수 있어요.</p>

      <div className="flex flex-wrap items-center gap-2">
        {shows.map((x) => (
          <button key={x.id} aria-pressed={x.id === show.id} onClick={() => pick(x.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${x.id === show.id ? "border-brand bg-brand text-onbrand" : "border-line hover:border-brand"}`}>
            {x.title || "(제목 없음)"}
          </button>
        ))}
        <button onClick={addShow} className={ghost}><Plus size={14} aria-hidden />새 공연</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/shows/${show.id}`} className={btn}><Eye size={14} aria-hidden />사용자 화면에서 보기</Link>
        <button onClick={() => onWriteNotice(show)} className={ghost}><Bell size={14} aria-hidden />이 공연 소식 쓰기</button>
        {ask ? (
          <>
            <span className="text-sm">이 공연과 회차를 모두 삭제할까요?</span>
            <button onClick={() => run((c) => deleteShow(c, show.id), "공연을 삭제했어요.").then(() => pick(null))} className={btn}>확인</button>
            <button onClick={() => setAsk(false)} className={ghost}>취소</button>
          </>
        ) : (
          <button onClick={() => setAsk(true)} className={ghost}><Trash2 size={14} aria-hidden />공연 삭제</button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg}</p>

      {/* key를 공연 id로 두어 공연을 바꾸면 입력 상태가 초기화돼요 */}
      <ShowForm key={`f-${show.id}`} show={show} run={run} />
      <RolesEditor key={`r-${show.id}`} show={show} run={run} />
      <SessionsEditor key={`s-${show.id}`} show={show} run={run} notify={setMsg} />
    </div>
  );
}
