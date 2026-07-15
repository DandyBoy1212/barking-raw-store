export function Paw({
  size = 100,
  color = "currentColor",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill={color}
      aria-hidden="true"
    >
      <ellipse cx="50" cy="70" rx="24" ry="20" />
      <ellipse cx="27" cy="42" rx="9" ry="13" transform="rotate(-18 27 42)" />
      <ellipse cx="42" cy="30" rx="9" ry="14" transform="rotate(-6 42 30)" />
      <ellipse cx="58" cy="30" rx="9" ry="14" transform="rotate(6 58 30)" />
      <ellipse cx="73" cy="42" rx="9" ry="13" transform="rotate(18 73 42)" />
    </svg>
  );
}
