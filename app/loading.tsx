/** 페이지를 불러오는 동안 보여줘요. 빈 화면 대신 '지금 불러오는 중'임을 알려줘서 덜 답답해요. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite" className="mx-auto max-w-3xl px-4 py-10">
      <p className="sr-only">불러오는 중…</p>
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-card" />)}
      </div>
    </main>
  );
}
