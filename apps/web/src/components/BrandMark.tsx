type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 36, className = '' }: BrandMarkProps) {
  return (
    <img
      className={`brand-mark brand-mark-image ${className}`.trim()}
      style={{ width: size, height: size }}
      src="/tracemind-mark.png"
      alt="TraceMind AI logo"
    />
  );
}
