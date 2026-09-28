"use client";

import { cn } from "@/lib/utils";

/** Native range input, styled. Works with keyboard and RTL out of the box. */
export function Slider({
  className,
  value,
  onValueChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn("h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--accent-from)]", className)}
      {...props}
    />
  );
}
