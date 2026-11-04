"use client";

import Link from "next/link";
import { useEffect } from "react";

/** 화면을 그리다 오류가 나면 보여요. 방문자에게는 쉬운 말로, 원인 확인용 번호는 작게 보여줘요. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-lg font-bold">잠시 문제가 생겼어요</p>
      <p className="mt-2 text-sm text-mute">정보를 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.<br />계속 안 되면 새로고침하거나 나중에 다시 들러 주세요.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-onbrand">다시 시도</button>
        <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium">처음으로</Link>
      </div>
      <details className="mt-8 text-left text-xs text-mute">
        <summary className="cursor-pointer text-center">운영자용 안내</summary>
        <p className="mt-2">Vercel의 Environment Variables(<code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)와 Supabase에서 SQL(supabase/migrations의 0001~0008) 실행 여부를 확인해 주세요. 자세한 내용은 DEPLOY.md에 있어요.</p>
        {error.digest && <p className="mt-1">오류 번호: <span className="select-all font-mono">{error.digest}</span></p>}
      </details>
    </main>
  );
}
