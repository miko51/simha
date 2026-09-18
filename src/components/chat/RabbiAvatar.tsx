"use client";

type Props = { size?: number; className?: string; decorative?: boolean };

export default function RabbiAvatar({ size = 56, className = "", decorative }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/rav-simha.png"
      width={size}
      height={size}
      alt={decorative ? "" : "Rav Simha"}
      className={`rounded-full object-cover bg-[#f6efdf] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
