"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { renderCalendar, type ImgSpec } from "@/lib/calendarImage";
import { downloadBlob, safeName } from "@/lib/download";

interface Props {
  /** 눌렀을 때의 화면 상태로 그릴 내용을 만들어요. */
  build: () => ImgSpec;
  /** 저장 파일 이름(확장자 제외) */
  fileBase: string;
  shareTitle: string;
  shareText: string;
  /** true면 지금 주소를 공유 링크로 함께 보내요. (마이페이지는 내 브라우저에만 있는 내용이라 끄세요) */
  withUrl?: boolean;
  className?: string;
}

/** '공유하기'와 '달력 이미지로 저장(PNG)' 버튼. */
export default function ShareBar({ build, fileBase, shareTitle, shareText, withUrl = false, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const btn = "inline-flex items-center gap-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium hover:border-brand disabled:opacity-50";

  const make = async () => ({ blob: await renderCalendar(build()), name: `${safeName(fileBase)}.png` });

  const save = async () => {
    setBusy(true); setMsg("");
    try { const { blob, name } = await make(); downloadBlob(blob, name); setMsg("달력 이미지를 저장했어요."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "이미지를 저장하지 못했어요."); }
    finally { setBusy(false); }
  };

  const share = async () => {
    setBusy(true); setMsg("");
    try {
      const url = withUrl ? window.location.href : undefined;
      const { blob, name } = await make();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text: url ? `${shareText}\n${url}` : shareText });
      } else if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, ...(url ? { url } : {}) });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url ? `${shareText}\n${url}` : shareText);
        setMsg(url ? "링크를 복사했어요. 이미지는 '저장'으로 받아 함께 보내세요." : "문구를 복사했어요. 이미지는 '저장'으로 받아 함께 보내세요.");
      } else {
        setMsg("이 브라우저는 공유를 지원하지 않아요. 이미지를 저장해서 보내 주세요.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "공유하지 못했어요.");
    } finally { setBusy(false); }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={share} disabled={busy} className={btn}><Share2 size={14} aria-hidden />공유하기</button>
        <button onClick={save} disabled={busy} className={btn}><Download size={14} aria-hidden />달력 이미지로 저장(PNG)</button>
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-mute">{msg}</p>
    </div>
  );
}
