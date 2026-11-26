import { LoadingScreen } from "@/components/ui/Loading";

/** 페이지를 처음 열거나 다른 페이지로 이동할 때 데이터가 올 때까지 보여줘요(모든 페이지 공통). 데이터가 오면 자동으로 사라져요. */
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-3xl px-4">
      <LoadingScreen slowHint />
    </main>
  );
}
