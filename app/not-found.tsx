import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="font-bold">공연을 찾을 수 없어요.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg border border-line px-3 py-2 text-sm font-medium">목록으로 돌아가기</Link>
    </main>
  );
}
