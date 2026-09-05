// Inlined from Capveon brand master (166×128, 1.8px strokes). currentColor so it follows the bench.

const STROKES = [
  "M25 93V91A58 62 0 0 1 68.5 31",
  "M97.5 31A58 62 0 0 1 141 91V93",
  "M38 93V91A45 51 0 0 1 128 91V93",
  "M25 92H38C38 98 40 101 45 104H19C23 100 25 97 25 92Z",
  "M128 92H141C141 98 143 101 147 104H121C126 101 128 98 128 92Z",
  "M18 104H46V114H18Z",
  "M120 104H148V114H120Z",
  "M60 13H106C105 18 102 22 99 25H67C64 22 61 18 60 13Z",
  "M67 25H99L96 37Q83 41 70 37Z",
] as const;

export function CapstoneArch({
  size = 22,
  className,
}: {
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 166 128"
      width={size}
      height={Math.round(size * (128 / 166))}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {STROKES.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
