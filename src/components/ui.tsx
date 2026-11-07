"use client";

import { cn, label } from "@/lib/utils";
import { Loader2, Minus, Plus, X } from "lucide-react";
import {
  ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useState,
} from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border border-chrome-line bg-white", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
  children,
}: {
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-chrome-line bg-chrome px-3 py-1.5", className)}>
      <div className="min-w-0">
        {title && <h2 className="text-[13px] font-bold text-slate-900">{title}</h2>}
        {description && <p className="text-xs text-slate-600">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-3 py-3", className)} {...props}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "outline" | "warning";
type ButtonSize = "sm" | "md" | "lg";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
>(({ className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props }, ref) => {
  const variants: Record<ButtonVariant, string> = {
    primary: "border border-primary-700 bg-primary-600 text-white hover:bg-primary-700",
    secondary: "border border-chrome-line bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-chrome-line bg-slate-50 text-slate-900 hover:bg-slate-200",
    danger: "border border-red-800 bg-red-700 text-white hover:bg-red-800",
    success: "border border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-800",
    warning: "border border-amber-600 bg-amber-400 text-slate-900 hover:bg-amber-500",
    ghost: "border border-transparent bg-transparent text-slate-700 hover:border-chrome-line hover:bg-slate-100",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-8 px-2.5 text-[13px] gap-1.5",
    md: "min-h-9 px-3.5 text-sm gap-2",
    lg: "min-h-11 px-5 text-[15px] gap-2",
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = "Button";

const fieldClass =
  "w-full rounded-sm border border-chrome-line bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, "min-h-9", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldClass, "min-h-9 pr-8", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClass, className)} rows={3} {...props} />
);
Textarea.displayName = "Textarea";

/**
 * Whole-number field with − and + buttons, for counts like adults and children.
 * The box can be cleared while typing (so "1" can be replaced with "3"); an
 * empty or out-of-range entry snaps back to the nearest allowed number on blur.
 */
export function CountInput({
  value,
  onChange,
  min = 0,
  max = 99,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  // What the person is typing; null shows the current value.
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };
  const buttonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-chrome-line bg-slate-50 text-slate-700 hover:bg-slate-200 disabled:opacity-40";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button type="button" className={buttonClass} onClick={() => step(-1)} disabled={value <= min} aria-label={`Fewer ${ariaLabel ?? ""}`.trim()}>
        <Minus className="h-4 w-4" />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={ariaLabel}
        className={cn(fieldClass, "min-h-9 min-w-0 px-2 text-center font-semibold")}
        value={draft ?? String(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
          if (digits === "") return setDraft("");
          const n = Number(digits);
          setDraft(n > max ? String(max) : String(n));
          if (clamp(n) !== value) onChange(clamp(n));
        }}
        onBlur={() => setDraft(null)}
      />
      <button type="button" className={buttonClass} onClick={() => step(1)} disabled={value >= max} aria-label={`More ${ariaLabel ?? ""}`.trim()}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Number field for settings such as tax % that can be cleared and retyped
 * (no stray leading 0) and, with allowNegative, takes a minus sign like -10.
 * An empty box reports null; leaving the box shows the saved number again.
 */
export function NumberInput({
  value,
  onChange,
  allowNegative,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  allowNegative?: boolean;
}) {
  // What the person is typing; null shows the current value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      type="text"
      // Phone number pads often have no minus key, so negative numbers get the full keyboard.
      inputMode={allowNegative ? "text" : "decimal"}
      autoComplete="off"
      className={cn(fieldClass, "min-h-9", className)}
      value={draft ?? (value === null ? "" : String(value))}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".").replace(allowNegative ? /[^\d.-]/g : /[^\d.]/g, "");
        setDraft(raw);
        if (raw === "") return onChange(null);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        setDraft(null);
        props.onBlur?.(e);
      }}
    />
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1 block text-[13px] font-bold text-slate-700", className)} {...props}>
      {children}
    </label>
  );
}

/** A form field with a label, an optional helper hint and "optional" marker. */
export function Field({
  label: text,
  hint,
  optional,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  // Link the label to a single Input / Select / Textarea so clicking the label
  // focuses it and screen readers announce the field name.
  const autoId = useId();
  let control = children;
  let target = htmlFor;
  if (!target && isValidElement<{ id?: string }>(children) && [Input, Select, Textarea, CountInput, NumberInput].includes(children.type as never)) {
    target = children.props.id ?? autoId;
    if (!children.props.id) control = cloneElement(children, { id: target });
  }
  return (
    <div className={className}>
      <Label htmlFor={target}>
        {text}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </Label>
      {control}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label: text,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary-600" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{text}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

const BADGE_COLORS: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
  // booking status
  reserved: "bg-amber-100 text-amber-800",
  checked_in: "bg-primary-100 text-primary-800",
  checked_out: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
  // room status
  available: "bg-emerald-100 text-emerald-800",
  occupied: "bg-primary-100 text-primary-800",
  maintenance: "bg-orange-100 text-orange-800",
  // housekeeping
  clean: "bg-emerald-100 text-emerald-800",
  dirty: "bg-red-100 text-red-700",
  cleaning: "bg-amber-100 text-amber-800",
  // payment state
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  overpaid: "bg-violet-100 text-violet-800",
};

export function Badge({ className, children, variant = "default" }: { className?: string; children: ReactNode; variant?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-px text-xs font-semibold",
        BADGE_COLORS[variant] || BADGE_COLORS.default,
        className
      )}
    >
      {children}
    </span>
  );
}

/** Badge that shows the plain-language label for any status code. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={status} className={className}>
      {label(status)}
    </Badge>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** For a question that must be answered with the buttons below. */
  hideClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center whitespace-normal text-left font-normal sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col border border-chrome-line bg-white shadow-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-primary-700 bg-primary-600 px-3 py-2 text-white">
          <div>
            <h2 className="text-[15px] font-bold">{title}</h2>
            {description && <p className="text-xs text-primary-100">{description}</p>}
          </div>
          {!hideClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-sm p-1 text-white hover:bg-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-chrome-line bg-slate-50 px-4 py-2">{footer}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "primary",
  onClick,
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "green" | "amber" | "red" | "sky" | "slate";
  onClick?: () => void;
}) {
  const tones = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
    slate: "bg-slate-100 text-slate-600",
  };
  const Comp = onClick ? "button" : "div";
  const long = typeof value === "string" && value.length > 9;
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 border border-chrome-line bg-white px-3 py-2 text-left",
        onClick && "hover:bg-primary-50"
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        {/* Long amounts get the full width on phones so a number is not split over two lines. */}
        <p className={cn("break-words font-bold tabular-nums text-slate-900", long ? "text-base" : "text-lg")}>{value}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {icon && <div className={cn("shrink-0 text-slate-400 [&_svg]:h-4 [&_svg]:w-4", long && "hidden min-[440px]:block")}>{icon}</div>}
    </Comp>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-chrome-line pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-[13px] text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-chrome-line bg-white px-6 py-8 text-center">
      {icon && <div className="mb-2 text-slate-400">{icon}</div>}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      {text}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap border-b border-chrome-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[13px]",
            value === t.value ? "border-chrome-line border-b-white bg-white font-bold text-slate-900" : "border-transparent text-slate-700 hover:text-primary-700 hover:underline"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-sm px-1 text-xs",
                value === t.value ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Small friendly tip box used to explain screens to new users. */
export function Tip({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success" }) {
  const tones = {
    info: "border-primary-200 bg-primary-50 text-primary-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cn("border px-3 py-2 text-[13px]", tones[tone])}>{children}</div>;
}

export function Row({ label: l, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1 text-sm", strong && "font-bold text-slate-900")}>
      <span className={strong ? "" : "text-slate-600"}>{l}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
