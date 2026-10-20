"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Show } from "@/types/show";
import { addCastMember, addRole, deleteCastMember, deleteRole, renameCastMember, renameRole } from "@/lib/db/shows";
import { Sec, TextInput, ghost, iconBtn, inp, type Run } from "./shared";

export default function RolesEditor({ show, run }: { show: Show; run: Run }) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  const addActor = (roleId: string, count: number) => {
    const name = (draft[roleId] ?? "").trim();
    if (!name) return;
    setDraft({ ...draft, [roleId]: "" });
    run((db) => addCastMember(db, roleId, name, count));
  };

  return (
    <Sec title="배역 · 배우" right={<button onClick={() => run((db) => addRole(db, show.id, "새 배역", show.roles.length))} className={ghost}><Plus size={14} aria-hidden />배역 추가</button>}>
      {show.roles.length === 0 && <p className="text-sm text-mute">배역을 추가한 뒤 배우를 등록해 주세요.</p>}
      <div className="space-y-3">
        {show.roles.map((r) => (
          <div key={r.id} className="rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <TextInput value={r.name} onCommit={(v) => v.trim() && run((db) => renameRole(db, r.id, v.trim()))} aria-label="배역명" className={`${inp} font-bold`} />
              <button onClick={() => run((db) => deleteRole(db, r.id), "배역을 삭제했어요. 해당 배역의 회차 캐스팅도 함께 지워졌어요.")} aria-label={`${r.name} 배역 삭제`} className={iconBtn}><Trash2 size={16} aria-hidden /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.actors.map((a) => (
                <span key={a.id} className="inline-flex items-center rounded-full border border-line bg-bg pl-3 pr-1">
                  <TextInput value={a.n} onCommit={(v) => v.trim() && run((db) => renameCastMember(db, a.id, v.trim()))} aria-label="배우 이름" size={Math.max(a.n.length, 2) + 1} className="bg-transparent text-sm" />
                  <button onClick={() => run((db) => deleteCastMember(db, a.id), "배우를 삭제했어요. 출연 회차는 '미정'으로 바뀌었어요.")} aria-label={`${a.n} 삭제`} className="rounded-full p-1.5 text-mute hover:text-brand"><X size={12} aria-hidden /></button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={draft[r.id] ?? ""} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addActor(r.id, r.actors.length); }}
                placeholder="배우 이름 입력 후 추가" aria-label={`${r.name} 배우 추가`} className={inp} />
              <button onClick={() => addActor(r.id, r.actors.length)} className={ghost}>추가</button>
            </div>
          </div>
        ))}
      </div>
    </Sec>
  );
}
