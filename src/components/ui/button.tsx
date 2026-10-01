import type { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "line";
}) {
  return (
    <button
      className={`button button-${variant} inline-flex items-center justify-center gap-2 ${className}`}
      {...props}
    />
  );
}
