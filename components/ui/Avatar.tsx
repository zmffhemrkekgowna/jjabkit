export default function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = ((name.charCodeAt(0) || 0) * 7 + (name.charCodeAt(1) || 0) * 13) % 360;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg,hsl(${h} 45% 38%),hsl(${(h + 40) % 360} 50% 26%))` }}
    >
      {name[0]}
    </span>
  );
}
