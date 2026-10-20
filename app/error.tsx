"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="font-bold">데이터를 불러오지 못했어요.</p>
      <p className="mt-2 text-sm text-mute">.env.local의 Supabase 주소와 키, 그리고 DB 마이그레이션 실행 여부를 확인해 주세요.</p>
      <button onClick={reset} className="mt-4 rounded-lg border border-line px-3 py-2 text-sm font-medium">다시 시도</button>
    </main>
  );
}
