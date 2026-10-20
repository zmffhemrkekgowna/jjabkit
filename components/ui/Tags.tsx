import { Percent, Star } from "lucide-react";
import type { Status } from "@/types/show";

export function StatusTag({ status, className = "" }: { status: Status; className?: string }) {
  const running = status === "running";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${running ? "bg-brand text-onbrand" : "bg-gold text-[var(--ongold)]"} ${className}`}>
      {running ? "공연 중" : "개막 예정"}
    </span>
  );
}

export function CurtainTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-[var(--ongold)]">
      <Star size={11} aria-hidden />커튼콜 데이
    </span>
  );
}

export function TimeSaleTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-xs font-medium text-brand">
      <Percent size={11} aria-hidden />타임세일
    </span>
  );
}
