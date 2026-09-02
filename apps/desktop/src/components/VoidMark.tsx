type VoidMarkProps = {
  size?: number;
};

export function VoidMark({ size = 28 }: VoidMarkProps) {
  return (
    <svg
      className="void-mark"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z" />
    </svg>
  );
}
