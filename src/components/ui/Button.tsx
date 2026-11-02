import type { ButtonHTMLAttributes } from "react";

const VARIANT = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: "md" | "sm";
  loading?: boolean;
};

export default function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${VARIANT[variant]} ${size === "sm" ? "btn-sm" : ""} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
