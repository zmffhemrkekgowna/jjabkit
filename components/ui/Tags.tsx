import { Star } from "lucide-react";
import { STATUS_LABEL, type ShowStatus } from "@/lib/status";

/** 상태는 개막일·종료일로 계산한 값이에요. 날짜가 비었거나 잘못돼 상태를 정할 수 없으면(null) '일정 미정'으로 보여요. */
export function StatusTag({ status, className = "" }: { status: ShowStatus | null; className?: string }) {
  const tone = status === "running" ? "bg-brand text-onbrand" : status === "upcoming" ? "bg-gold text-[var(--ongold)]" : status === "ended" ? "bg-mute text-bg" : "border border-line bg-card text-mute";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone} ${className}`}>{status ? STATUS_LABEL[status] : "일정 미정"}</span>;
}

export function CurtainTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-[var(--ongold)]">
      <Star size={11} aria-hidden />커튼콜 데이
    </span>
  );
}

