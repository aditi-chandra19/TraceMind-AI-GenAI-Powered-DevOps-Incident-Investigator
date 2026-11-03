type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 36, className = '' }: BrandMarkProps) {
  return (
    <span
      className={`brand-mark ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label="TraceMind AI"
    >
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M6.5 21h6l3.2-8.5 6.1 15 4.6-11.2 2.4 4.7h4.7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6.5" cy="21" r="1.7" fill="currentColor" />
        <circle cx="33.5" cy="21" r="1.7" fill="currentColor" />
        <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeOpacity=".16" />
      </svg>
    </span>
  );
}
