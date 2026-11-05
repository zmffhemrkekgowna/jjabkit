"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Role } from "@/types/show";
import { inp } from "./shared";

/**
 * 배역 하나의 배우 고르기.
 * - PC(sm 이상): 예전처럼 '배역명 + 드롭다운'이에요. (달라진 것 없음)
 * - 모바일: 배역명과 선택된 배우가 한 카드 안에 붙어 있고, 누르면 아래에서 선택 패널이 올라와요(검색 · 미정 · 현재 선택 표시).
 * 값은 배우 id("" = 미정)이고, 바꾸면 onChange가 한 번 불려요. 저장 방식은 그대로예요.
 */
export default function CastField({ role, value, onChange, compact = false }: { role: Role; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const cur = role.actors.find((a) => a.id === value);
  const label = role.short && compact ? role.short : role.name;

  return (
    <>
      {/* PC */}
      <label className={`hidden items-center gap-1.5 text-xs text-mute sm:flex ${compact ? "min-w-[9.5rem] flex-1" : ""}`}>
        <span className={`shrink-0 truncate ${compact ? "w-12" : "w-16"}`} title={role.name}>{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${role.name} 배우`} className={inp}>
          <option value="">미정</option>
          {role.actors.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}
        </select>
      </label>

      {/* 모바일 */}
      <div className="min-w-0 rounded-xl border border-line bg-bg p-2 sm:hidden">
        <p className="break-words px-1 pb-1 text-xs font-bold text-mute">{role.name}</p>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${role.name} 배우 선택, 현재 ${cur?.n ?? "미정"}`}
          className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 text-left text-base">
          <span className={`min-w-0 break-words ${cur ? "font-medium" : "text-mute"}`}>{cur?.n ?? "미정"}</span>
          <ChevronDown size={18} aria-hidden className="shrink-0 text-mute" />
        </button>
      </div>
      {open && <ActorSheet role={role} value={value} onPick={(id) => { setOpen(false); if (id !== value) onChange(id); }} onClose={() => setOpen(false)} />}
    </>
  );
}

function ActorSheet({ role, value, onPick, onClose }: { role: Role; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return t ? role.actors.filter((a) => a.n.toLowerCase().includes(t)) : role.actors; }, [q, role.actors]);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>("button, input");
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const row = (on: boolean) => `flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-4 py-2 text-left text-base ${on ? "bg-hit font-bold text-brand" : "hover:bg-hit"}`;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`${role.name} 배우 선택`}
        className="flex max-h-[85vh] max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="min-w-0 break-words font-bold">{role.name} 배우 선택</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="선택 취소하고 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"><X size={18} aria-hidden /></button>
        </div>
        <div className="relative px-4 pt-3">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-7 top-1/2 mt-1.5 -translate-y-1/2 text-mute" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="배우 이름 검색" aria-label="배우 이름 검색" autoComplete="off"
            className="min-h-[48px] w-full rounded-xl border border-line bg-bg pl-10 pr-3 text-base" />
        </div>
        <ul role="listbox" aria-label="배우 목록" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-3">
          <li role="option" aria-selected={value === ""}>
            <button type="button" onClick={() => onPick("")} className={row(value === "")}><span className="text-mute">미정 (선택 해제)</span>{value === "" && <Check size={18} aria-hidden />}</button>
          </li>
          {list.map((a) => (
            <li key={a.id} role="option" aria-selected={a.id === value}>
              <button type="button" onClick={() => onPick(a.id)} className={row(a.id === value)}><span className="min-w-0 break-words">{a.n}</span>{a.id === value && <Check size={18} aria-hidden />}</button>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-mute">{role.actors.length === 0 ? "이 배역에 등록된 배우가 없어요. '배역 · 배우'에서 먼저 추가해 주세요." : `'${q.trim()}'와 맞는 배우가 없어요.`}</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
