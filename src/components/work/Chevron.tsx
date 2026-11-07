// The logo's ">" chevron as a small inline icon (points left with `back`).
export function Chevron({ back = false, className }: { back?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width="0.9em"
      height="0.9em"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={back ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M4 1.5 8.5 6 4 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
