"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { Show } from "@/types/show";
import { addCastMember, addRole, deleteCastMember, deleteRole, renameCastMember } from "@/lib/db/shows";
import { SLOT_PREFIX } from "@/lib/scheduleImport";
import { Sec, TextInput, ghost, iconBtn, inp, type Run } from "./shared";

/**
 * 콘서트 출연진 편집기. 데이터는 연극·뮤지컬과 같은 구조(배역=출연 슬롯, 슬롯마다 후보 배우)를 그대로 써요.
 * - 출연자는 여기서 한 번만 등록해요. 등록하면 모든 슬롯의 후보에 자동으로 들어가요.
 * - 슬롯은 '한 회차에 동시에 서는 사람 수'예요. 회차마다 슬롯별로 누가 서는지는 '회차' 편집에서 정해요(회차마다 달라도 돼요).
 * - 사용자 화면에서는 슬롯 이름이 보이지 않고 배우 이름만 나와요.
 */
export default function ConcertCastEditor({ show, run }: { show: Show; run: Run }) {
  const [name, setName] = useState("");
  const slots = show.roles;
  const pool = useMemo(() => {
    const m = new Map<string, { name: string; members: { id: string; roleId: string }[] }>();
    for (const r of slots) for (const a of r.actors) {
      const k = a.n.trim();
      const e = m.get(k) ?? { name: k, members: [] };
      e.members.push({ id: a.id, roleId: r.id }); m.set(k, e);
    }
    return [...m.values()];
  }, [slots]);
  // 슬롯마다 후보가 빠진 곳이 있으면(예전 데이터·엑셀 가져오기 등) 한 번에 맞춰 줘요
  const missing = pool.reduce((n, p) => n + slots.filter((r) => !p.members.some((m) => m.roleId === r.id)).length, 0);
  const slotName = (n: number) => `${SLOT_PREFIX} ${n}`;

  const addPerformer = () => {
    const nm = name.trim();
    if (!nm) return;
    if (pool.some((p) => p.name === nm)) { setName(""); return; }
    setName("");
    run(async (db) => {
      const targets = slots.length ? slots.map((r) => ({ id: r.id, count: r.actors.length })) : [{ id: await addRole(db, show.id, slotName(1), 0), count: 0 }];
      for (const t of targets) await addCastMember(db, t.id, nm, t.count);
    }, `'${nm}'을(를) 출연진에 추가했어요.`);
  };
  const addSlot = () => run(async (db) => {
    const id = await addRole(db, show.id, slotName(slots.length + 1), slots.length);
    let i = 0;
    for (const p of pool) await addCastMember(db, id, p.name, i++);
  }, `${slotName(slots.length + 1)}을(를) 추가했어요.`);
  const removeSlot = () => { const last = slots[slots.length - 1]; if (last) run((db) => deleteRole(db, last.id), `${last.name}을(를) 삭제했어요. 그 슬롯의 회차 출연 정보도 함께 지워졌어요.`); };
  const fill = () => run(async (db) => {
    for (const r of slots) {
      let n = r.actors.length;
      for (const p of pool) if (!p.members.some((m) => m.roleId === r.id)) await addCastMember(db, r.id, p.name, n++);
    }
  }, "모든 슬롯에서 같은 출연자를 고를 수 있게 맞췄어요.");

  return (
    <Sec title="출연진 · 출연 슬롯">
      <p className="mb-3 text-xs leading-relaxed text-mute">출연자를 한 번만 등록하면 모든 슬롯에서 고를 수 있어요. 회차마다 누가 서는지는 아래 ‘회차’에서 슬롯별로 정해요. 한 회차에 서는 최대 인원만큼 슬롯을 만들어 주세요.</p>

      <div className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">출연자 <span className="font-normal text-mute">{pool.length}명</span></p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="출연자 목록">
          {pool.length === 0 && <p className="text-sm text-mute">아직 등록된 출연자가 없어요.</p>}
          {pool.map((p) => (
            <span key={p.name} className="inline-flex items-center rounded-full border border-line bg-bg pl-3 pr-1">
              <TextInput value={p.name} onCommit={(v) => { const nv = v.trim(); if (nv && nv !== p.name) run(async (db) => { for (const m of p.members) await renameCastMember(db, m.id, nv); }); }} aria-label="출연자 이름" size={Math.max(p.name.length, 2) + 1} className="bg-transparent py-1.5 text-sm outline-none" />
              <button onClick={() => run(async (db) => { for (const m of p.members) await deleteCastMember(db, m.id); }, "출연자를 삭제했어요. 출연하던 회차는 ‘미정’으로 바뀌었어요.")} aria-label={`${p.name} 삭제`} className={`${iconBtn} border-0`}><X size={14} aria-hidden /></button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPerformer(); }} placeholder="출연자 이름 입력 후 추가" aria-label="출연자 추가" className={inp} />
          <button onClick={addPerformer} className={ghost}>추가</button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">출연 슬롯 <span className="font-normal text-mute">{slots.length}개 · 한 회차 최대 {slots.length}명</span></p>
          <span className="ml-auto flex gap-2">
            <button onClick={removeSlot} disabled={slots.length === 0} aria-label="마지막 출연 슬롯 삭제" className={`${ghost} disabled:opacity-40`}><Minus size={14} aria-hidden />슬롯 삭제</button>
            <button onClick={addSlot} aria-label="출연 슬롯 추가" className={ghost}><Plus size={14} aria-hidden />슬롯 추가</button>
          </span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs text-mute" aria-label="출연 슬롯 목록">
          {slots.map((r) => <li key={r.id} className="rounded-full border border-line px-2.5 py-1">{r.name}</li>)}
          {slots.length === 0 && <li>출연자를 추가하면 슬롯 1개가 자동으로 만들어져요.</li>}
        </ul>
        {pool.length > slots.length && slots.length > 0 && <p className="mt-2 text-xs text-mute">출연자가 슬롯보다 많아도 괜찮아요. 한 회차에 동시에 서는 인원 수만큼만 있으면 돼요.</p>}
        {missing > 0 && (
          <div role="status" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-bg p-2 text-xs">
            <span>일부 슬롯에서 고를 수 없는 출연자가 있어요.</span>
            <button onClick={fill} className={ghost}>모든 슬롯에서 고를 수 있게 맞추기</button>
          </div>
        )}
      </div>
    </Sec>
  );
}
