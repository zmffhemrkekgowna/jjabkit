"use client";
import { useEffect, useState } from "react";

/** 로딩이 12초 넘게 끝나지 않을 때만 새로고침 안내를 보여줘요(연결이 끊겨 계속 도는 상황 대비). 로딩이 끝나면 함께 사라져요. */
export default function LoadingSlowHint({ after = 12000 }: { after?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSlow(true), after); return () => window.clearTimeout(t); }, [after]);
  if (!slow) return null;
  return (
    <div className="mt-2 space-y-2 text-xs text-mute" data-testid="loading-slow">
      <p>생각보다 오래 걸리고 있어요. 계속 이대로면 새로고침해 주세요.</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:border-brand hover:text-brand">새로고침</button>
        <a href="/" className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:border-brand hover:text-brand">처음으로</a>
      </div>
    </div>
  );
}
