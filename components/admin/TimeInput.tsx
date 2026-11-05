"use client";

import { useEffect, useId, useState } from "react";
import { parseTime, TIME_HELP } from "@/lib/timeInput";
import { inp } from "./shared";

/**
 * 24시간제 시간 직접 입력(HH:mm). 숫자 키패드가 뜨고, 4자리를 치면 콜론이 자동으로 들어가요.
 * 올바른 시간일 때만 onChange("HH:mm")를 부르고, 아직 덜 쳤거나 잘못됐으면 onChange("")로 알려요(저장 막힘).
 */
export default function TimeInput({ value, onChange, label, className = inp, onBlur }: { value: string; onChange: (v: string) => void; label?: string; className?: string; onBlur?: () => void }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  const eid = useId();
  // 바깥 값이 (저장 등으로) 바뀌면 입력칸도 따라가요. 내가 치는 중인 값과 같은 시간이면 건드리지 않아요.
  useEffect(() => { if (value && parseTime(text, true) !== value) { setText(value); setBad(false); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (raw: string) => {
    let t = raw.replace(/[^\d:：.]/g, "").replace(/[：.]/g, ":").slice(0, 5);
    if (/^\d{4}$/.test(t)) t = `${t.slice(0, 2)}:${t.slice(2)}`;
    setText(t); setBad(false);
    onChange(parseTime(t) ?? "");
  };
  const blur = () => {
    const p = parseTime(text, true);
    if (p) { setText(p); setBad(false); onChange(p); }
    else { setBad(text.trim() !== ""); onChange(""); }
    onBlur?.();
  };
  return (
    <span className="block">
      <input type="text" inputMode="numeric" autoComplete="off" maxLength={5} placeholder="19:30" value={text}
        onChange={(e) => change(e.target.value)} onBlur={blur} aria-label={label ?? "시간"} aria-invalid={bad} aria-describedby={bad ? eid : undefined}
        className={`${className} ${bad ? "!border-red-500" : ""}`} />
      {bad && <span id={eid} role="alert" className="mt-1 block text-xs text-red-600">{TIME_HELP}</span>}
    </span>
  );
}
 
