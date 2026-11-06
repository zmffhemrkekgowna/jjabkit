import { Star } from "lucide-react";
import { isHex6, readableText } from "@/lib/color";

/** 달력 칸 안의 회차 카드. 시간을 크게, 출연진은 쉼표로 이어서 자연스럽게 줄바꿈해요. 배우는 3명까지 보여주고 더 있으면 …로 줄여요. */
export const CAST_SHOWN = 3;
/** 넓은 화면(lg 이상)에서는 칸이 넓어서 이만큼까지 보여줘요 */
export const CAST_SHOWN_WIDE = 6;

interface Props {
  time: string; star?: boolean; all: string[];
  /** hit: 고른 배우가 나오는 회차, dim: 고른 배우가 안 나오는 회차(흐리게) */
  state?: "normal" | "hit" | "dim";
  /** 공연별 스케줄 색(#rrggbb). 있으면 카드 바탕으로 쓰고, 글자색은 바탕에 맞춰 자동으로 골라요. 비어 있으면 기본 카드색이에요. */
  color?: string;
  as?: "button" | "span";
  onClick?: () => void;
  ariaLabel?: string;
}

export default function SlotCard({ time, star, all, state = "normal", color, as = "button", onClick, ariaLabel }: Props) {
  const names = all.slice(0, CAST_SHOWN), more = all.length > names.length;
  const tinted = !!color && isHex6(color) && state !== "hit";
  const style = tinted ? { background: color, color: readableText(color!) } : undefined;
  const cls = `block w-full min-w-0 rounded-md px-1 py-1 text-left leading-tight transition sm:px-1.5 ${state === "hit" ? "bg-brand text-onbrand" : tinted ? "" : "bg-slot text-onslot"} ${state === "dim" ? "opacity-40" : ""} ${as === "button" ? "hover:brightness-110" : ""}`;
  const body = (
    <>
      <span className="flex items-center gap-x-0.5 text-[11px] font-bold tabular-nums sm:gap-x-1 sm:text-xs">{time}{star && <Star size={10} aria-hidden />}</span>
      <span className={`mt-0.5 block break-keep text-[10px] leading-[1.3] [overflow-wrap:anywhere] sm:text-[11px] ${tinted ? "" : "opacity-90"}`}>{names.join(", ")}
        {more && <span className="hidden lg:inline">{all.slice(CAST_SHOWN, CAST_SHOWN_WIDE).map((n) => `, ${n}`).join("")}</span>}
        {more && <span className={all.length > CAST_SHOWN_WIDE ? "" : "lg:hidden"}> …</span>}</span>
    </>
  );
  return as === "button"
    ? <button onClick={onClick} aria-label={ariaLabel} title={all.join(" / ")} style={style} className={cls}>{body}</button>
    : <span title={all.join(" / ")} style={style} className={cls}>{body}</span>;
}
