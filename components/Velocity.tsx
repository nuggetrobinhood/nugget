import { multiple } from "../lib/format";

export function VelocityBadge({ label, ratio }: { label: string; ratio: number }) {
  const nice = label.charAt(0) + label.slice(1).toLowerCase();
  return (
    <span className={`vel ${label}`}>
      {nice}
      {ratio > 0 && <span className="x">{multiple(ratio)}</span>}
    </span>
  );
}
