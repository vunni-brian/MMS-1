import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "amber" | "red" | "purple" | "slate";

const toneStyles: Record<Tone, string> = {
  blue: "border-blue-200 bg-blue-50/60 text-blue-700",
  green: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  amber: "border-amber-200 bg-amber-50/70 text-amber-700",
  red: "border-red-200 bg-red-50/70 text-red-700",
  purple: "border-violet-200 bg-violet-50/70 text-violet-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

const topBorderStyles: Record<Tone, string> = {
  blue: "border-t-blue-500",
  green: "border-t-emerald-500",
  amber: "border-t-amber-500",
  red: "border-t-red-500",
  purple: "border-t-violet-500",
  slate: "border-t-slate-500",
};

export const MockupPage = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("min-h-full bg-slate-50 p-4 text-slate-950 md:p-6", className)}>{children}</div>
);

export const MockupHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) => (
  <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
    <div className="min-w-0">
      {eyebrow ? <p className="text-xs font-semibold text-slate-500">{eyebrow}</p> : null}
      <h1 className="text-2xl font-bold tracking-normal text-primary font-heading">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export const MockupCard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>{children}</section>
);

export const MockupPanel = ({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <MockupCard className={cn("overflow-hidden", className)}>
    {title || actions ? (
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        {title ? <h2 className="text-base font-bold text-slate-950 font-heading">{title}</h2> : <span />}
        {actions}
      </div>
    ) : null}
    <div className="p-4">{children}</div>
  </MockupCard>
);

export const MockupStatCard = ({
  title,
  value,
  subtitle,
  tone = "blue",
  className,
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  tone?: Tone;
  className?: string;
}) => (
  <MockupCard className={cn("min-h-[112px] border-t-4 p-4", topBorderStyles[tone], className)}>
    <p className="text-xs font-semibold text-slate-500">{title}</p>
    <div className="mt-2 text-2xl font-bold leading-tight text-slate-950 font-heading tabular-nums">{value}</div>
    {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
  </MockupCard>
);

export const StatusPill = ({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) => (
  <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", toneStyles[tone], className)}>
    {children}
  </span>
);

export const IconAction = ({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: ElementType;
  label: string;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn("flex w-full items-center gap-3 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50", className)}
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1 text-xs font-semibold text-blue-700">{label}</span>
  </button>
);

export const MiniAreaChart = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 360 180" className={cn("h-full min-h-[180px] w-full", className)} aria-hidden="true">
    <defs>
      <linearGradient id="mock-area-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.34" />
        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.04" />
      </linearGradient>
    </defs>
    {[40, 80, 120, 160].map((y) => (
      <line key={y} x1="24" x2="344" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
    ))}
    <path d="M32 142 C54 116, 64 120, 84 96 C102 76, 112 94, 132 62 C152 30, 170 58, 188 88 C208 122, 222 52, 246 50 C270 52, 284 106, 306 96 C326 88, 332 80, 344 78 L344 164 L32 164 Z" fill="url(#mock-area-fill)" />
    <path d="M32 142 C54 116, 64 120, 84 96 C102 76, 112 94, 132 62 C152 30, 170 58, 188 88 C208 122, 222 52, 246 50 C270 52, 284 106, 306 96 C326 88, 332 80, 344 78" fill="none" stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    {["1 May", "8 May", "15 May", "22 May", "31 May"].map((label, index) => (
      <text key={label} x={32 + index * 78} y="176" fill="#64748b" fontSize="10">{label}</text>
    ))}
  </svg>
);

export const MiniBarChart = ({ className }: { className?: string }) => {
  const bars = [48, 35, 56, 43, 52, 71, 54];

  return (
    <svg viewBox="0 0 320 180" className={cn("h-full min-h-[180px] w-full", className)} aria-hidden="true">
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="24" x2="300" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {bars.map((height, index) => (
        <rect key={index} x={42 + index * 37} y={160 - height * 1.65} width="18" height={height * 1.65} rx="3" fill="#2563eb" />
      ))}
      {["1 May", "8 May", "15 May", "22 May", "31 May"].map((label, index) => (
        <text key={label} x={32 + index * 60} y="176" fill="#64748b" fontSize="10">{label}</text>
      ))}
    </svg>
  );
};

export const SelectShell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm", className)}>
    <div className="flex h-full items-center">{children}</div>
  </div>
);
