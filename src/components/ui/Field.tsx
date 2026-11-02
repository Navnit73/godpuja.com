import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

type Common = { label: string; error?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function Input({ label, error, hint, id, className = "", ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div>
        <label htmlFor={fid} className="label">{label}</label>
        <input ref={ref} id={fid} className={`input ${className}`} aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...rest} />
        {hint && !error && <p id={`${fid}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
        {error && <p id={`${fid}-err`} className="field-error">{error}</p>}
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ label, error, id, className = "", children, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div>
        <label htmlFor={fid} className="label">{label}</label>
        <select ref={ref} id={fid} className={`input ${className}`} aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : undefined} {...rest}>
          {children}
        </select>
        {error && <p id={`${fid}-err`} className="field-error">{error}</p>}
      </div>
    );
  },
);
