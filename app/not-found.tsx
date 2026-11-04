import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-lg font-bold">페이지를 찾을 수 없어요</p>
      <p className="mt-2 text-sm text-mute">주소가 바뀌었거나, 삭제된 공연일 수 있어요.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium">공연 목록으로 돌아가기</Link>
    </main>
  );
}
