"use client";

export interface NumberStepperProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Compact numeric input with inline minus / plus buttons.
 * Keeps the value as a string so it plugs into existing form state.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  id,
  required = false,
  disabled = false,
  placeholder,
  ariaLabel,
  className = "",
}: NumberStepperProps) {
  const parsed = Number.parseInt(value, 10);
  const current = Number.isFinite(parsed) ? parsed : min;
  const canDecrement = !disabled && current - step >= min;
  const canIncrement = !disabled && (max === undefined || current + step <= max);

  const clamp = (n: number) => {
    let next = Math.max(min, n);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };

  const adjust = (delta: number) => {
    onChange(String(clamp(current + delta)));
  };

  return (
    <div className={`number-stepper${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="number-stepper-btn"
        onClick={() => adjust(-step)}
        disabled={!canDecrement}
        aria-label={ariaLabel ? `Decrease ${ariaLabel.toLowerCase()}` : "Decrease"}
        tabIndex={-1}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="number-stepper-input"
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (value.trim() === "" || !Number.isFinite(Number.parseInt(value, 10))) {
            onChange(String(min));
          } else {
            const normalized = clamp(Number.parseInt(value, 10));
            if (String(normalized) !== value) onChange(String(normalized));
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (canIncrement) adjust(step);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (canDecrement) adjust(-step);
          }
        }}
      />
      <button
        type="button"
        className="number-stepper-btn"
        onClick={() => adjust(step)}
        disabled={!canIncrement}
        aria-label={ariaLabel ? `Increase ${ariaLabel.toLowerCase()}` : "Increase"}
        tabIndex={-1}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
