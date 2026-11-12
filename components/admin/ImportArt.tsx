"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Pipette, RotateCcw, Trash2 } from "lucide-react";
import Poster from "../ui/Poster";
import SlotCard from "../casting/SlotCard";
import { isHex6 } from "@/lib/color";
import { candidatesFromImage, type Candidate } from "@/lib/posterColor";
import { artChanges, type ArtDraft } from "@/lib/db/importArt";
import { ghost, inp } from "./shared";

export const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const POSTER_MAX_MB = 8;
/** JPG·JPEG·PNG·WEBP만, 8MB 이하. 문제가 있으면 안내 문구를, 괜찮으면 빈 문자열을 돌려줘요. */
export function posterFileProblem(f: { name: string; type: string; size: number }): string {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  const okType = POSTER_TYPES.includes(f.type) || (!f.type && ["jpg", "jpeg", "png", "webp"].includes(ext));
  if (!okType || !["jpg", "jpeg", "png", "webp"].includes(ext)) return "JPG·JPEG·PNG·WEBP 이미지 파일만 올릴 수 있어요.";
  if (f.size > POSTER_MAX_MB * 1024 * 1024) return `이미지가 너무 커요. ${POSTER_MAX_MB}MB 이하로 줄여서 올려 주세요.`;
  return "";
}

const normHex = (v: string) => {
  const t = v.trim().replace(/^#/, "");
  const six = /^[0-9a-fA-F]{3}$/.test(t) ? t.split("").map((c) => c + c).join("") : t;
  return /^[0-9a-fA-F]{6}$/.test(six) ? `#${six.toLowerCase()}` : "";
};

interface Props {
  title: string;
  /** 이미 등록된 공연이면 지금 저장돼 있는 포스터 주소와 스케줄 색(없으면 빈 문자열) */
  current: { img: string; color: string; grad: string } | null;
  draft: ArtDraft;
  onChange: (d: ArtDraft) => void;
}

export default function ImportArt({ title, current, draft, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [hexText, setHexText] = useState(draft.color ?? "");
  const [hexBad, setHexBad] = useState(false);

  useEffect(() => {
    if (!draft.file) { setPreview(""); return; }
    const u = URL.createObjectURL(draft.file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [draft.file]);
  useEffect(() => { setHexText(draft.color ?? ""); setHexBad(false); }, [draft.color]);

  const savedColor = current?.color ?? "";
  const shownColor = draft.color !== undefined ? draft.color : savedColor;
  const pickerValue = isHex6(shownColor) ? shownColor : "#8b1e3f";
  const posterShown = draft.removePoster ? "" : preview || current?.img || "";
  const canExtract = !!draft.file || (!!current?.img && !draft.removePoster);

  const extract = async (src: Blob | string) => {
    setExtracting(true); setMsg("");
    try {
      const list = await candidatesFromImage(src, 4);
      setCands(list);
      if (!list.length) setMsg("포스터에서 대표 색을 찾지 못했어요(흑백·회색 위주예요). 아래에서 직접 골라 주세요.");
    } catch {
      setCands(null);
      setMsg("색 자동 추출에 실패했어요. 포스터 업로드는 그대로 되고, 색은 아래에서 직접 고르면 돼요.");
    } finally { setExtracting(false); }
  };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const p = posterFileProblem(f);
    if (p) { setMsg(p); return; }
    setMsg(""); setCands(null);
    onChange({ ...draft, file: f, removePoster: false });
    void extract(f); // 올리자마자 후보를 보여 줘요. 적용은 관리자가 직접 눌러야 해요.
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); };
  const removePoster = () => {
    setCands(null); setMsg("");
    if (draft.file) onChange({ ...draft, file: undefined });
    else if (current?.img) onChange({ ...draft, removePoster: true });
  };
  const setColor = (hex: string | undefined) => onChange({ ...draft, color: hex });

  const n = artChanges(draft);
  return (
    <div className="border-t border-line px-3 py-2" data-testid="art-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="art-toggle" className="flex w-full flex-wrap items-center gap-2 text-left text-sm font-medium">
        <ImagePlus size={15} aria-hidden /> 포스터 · 스케줄 색상 <span className="text-xs font-normal text-mute">(선택{current ? " · 지금 값은 바꾸지 않으면 그대로 유지돼요" : ""})</span>
        {draft.file && <span className="rounded-full bg-hit px-2 py-0.5 text-[11px] font-bold text-brand">{current?.img ? "포스터 교체 예정" : "포스터 등록 예정"}</span>}
        {draft.removePoster && <span className="rounded-full bg-hit px-2 py-0.5 text-[11px] font-bold text-brand">포스터 삭제 예정</span>}
        {draft.color !== undefined && <span className="rounded-full bg-hit px-2 py-0.5 text-[11px] font-bold text-brand">{draft.color ? "색 변경 예정" : "색 자동 배정으로"}</span>}
        <span className="ml-auto text-xs text-mute">{open ? "접기" : n ? "펼쳐서 확인" : "펼치기"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]" data-testid="art-body">
          <div className="flex gap-3 sm:block">
            <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl" data-testid="art-poster">
              <Poster show={{ title, img: posterShown, grad: current?.grad || "#3b1d5a,#c2410c", poster: [title] }} className="h-full w-full text-xs" />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              data-testid="art-drop" data-drag={drag ? "1" : "0"}
              className={`rounded-xl border-2 border-dashed p-3 text-sm ${drag ? "border-brand bg-hit" : "border-line bg-bg"}`}>
              <p className="text-xs text-mute">포스터 이미지를 여기로 끌어다 놓거나 파일을 골라 주세요. (JPG·JPEG·PNG·WEBP, {POSTER_MAX_MB}MB 이하)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden data-testid="art-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
                <button type="button" onClick={() => fileRef.current?.click()} className={ghost} data-testid="art-pick"><ImagePlus size={14} aria-hidden />{posterShown ? "다른 이미지로 교체" : "파일 선택"}</button>
                {(draft.file || (current?.img && !draft.removePoster)) && (
                  <button type="button" onClick={removePoster} className={ghost} data-testid="art-remove"><Trash2 size={14} aria-hidden />{draft.file ? "선택 취소" : "포스터 삭제"}</button>
                )}
                {draft.removePoster && <button type="button" onClick={() => onChange({ ...draft, removePoster: false })} className="text-xs text-mute underline" data-testid="art-remove-undo">삭제 취소</button>}
              </div>
              {draft.file && <p className="mt-1 break-all text-xs text-mute" data-testid="art-filename">{draft.file.name} · {(draft.file.size / 1024 / 1024).toFixed(1)}MB</p>}
              {draft.removePoster && <p className="mt-1 text-xs font-medium text-brand">일괄 등록을 누르면 이 공연의 포스터가 지워지고 기본 포스터가 보여요.</p>}
              {!current?.img && !draft.file && <p className="mt-1 text-xs text-mute">포스터가 없으면 기존처럼 기본 포스터가 보여요.</p>}
            </div>

            <div role="group" aria-label="스케줄 색상" className="rounded-xl bg-bg p-3">
              <p className="text-sm font-medium">스케줄 색상 <span className="text-xs font-normal text-mute">{savedColor ? `지금 저장된 색 ${savedColor}` : "저장된 색 없음 — 비워 두면 자동 배정돼요"}</span></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => canExtract && void extract(draft.file ?? current!.img)} disabled={!canExtract || extracting} className={ghost} data-testid="art-extract">
                  <Pipette size={14} aria-hidden />{extracting ? "분석 중…" : "포스터에서 대표 색상 추출"}
                </button>
                {!canExtract && <span className="text-xs text-mute">포스터를 올리면 사용할 수 있어요.</span>}
              </div>
              {cands && cands.length > 0 && (
                <div className="mt-2" data-testid="art-cands">
                  <p className="text-xs text-mute">추천 색(비중 순). 눌러서 적용해 보세요. 마음에 안 들면 아래에서 직접 바꿀 수 있어요.</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {cands.map((c) => (
                      <button type="button" key={c.hex} onClick={() => setColor(c.hex)} aria-label={`추출한 색 ${c.hex} 적용`} aria-pressed={draft.color === c.hex} data-testid="art-cand"
                        className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${draft.color === c.hex ? "border-ink ring-2 ring-[var(--brand)]" : "border-line"}`}>
                        <span className="h-6 w-6 rounded-full border border-line" style={{ background: c.hex }} aria-hidden />
                        <span className="font-mono">{c.hex}</span><span className="text-mute">{Math.round(c.share * 100)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="color" value={pickerValue} onChange={(e) => setColor(e.target.value)} aria-label="스케줄 색상 선택기" data-testid="art-picker" className="h-9 w-12 cursor-pointer rounded border border-line bg-card p-0.5" />
                <label className="flex items-center gap-1 text-xs text-mute">HEX
                  <input value={hexText} onChange={(e) => { setHexText(e.target.value); setHexBad(false); }} placeholder="#ea580c" maxLength={7} aria-label="스케줄 색 HEX 코드" aria-invalid={hexBad} data-testid="art-hex"
                    onBlur={() => { if (!hexText.trim()) return; const h = normHex(hexText); if (h) setColor(h); else setHexBad(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={`${inp} !w-28 font-mono ${hexBad ? "border-brand" : ""}`} />
                </label>
                <button type="button" onClick={() => setColor("")} className="inline-flex items-center gap-1 text-xs text-mute underline" data-testid="art-color-reset"><RotateCcw size={12} aria-hidden />초기화(자동 배정)</button>
                {draft.color !== undefined && <button type="button" onClick={() => setColor(undefined)} className="text-xs text-mute underline" data-testid="art-color-undo">변경 취소</button>}
                <div className="w-28" aria-label="미리보기" data-testid="art-color-preview" data-color={isHex6(shownColor) ? shownColor : ""}>
                  <SlotCard as="span" color={isHex6(shownColor) ? shownColor : undefined} time="19:30" all={["홍길동", "김철수", "이영희"]} />
                </div>
              </div>
              {hexBad && <p role="alert" className="mt-1 text-xs font-medium text-brand">색 코드는 #ea580c 같은 6자리 HEX로 입력해 주세요.</p>}
              {draft.color === "" && <p className="mt-1 text-xs text-mute">등록하면 이 공연의 색이 비워지고, 자동 배정 색(공연 사이에서 겹치지 않게)이 다시 정해져요.</p>}
            </div>
            {msg && <p role="status" className="text-xs font-medium text-brand" data-testid="art-msg">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
