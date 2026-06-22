/** A branded logo component that displays the app logo with optional text, tagline, and status dot. */
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showTagline?: boolean;
  showStatusDot?: boolean;
  variant?: "default" | "sidebar" | "light";
  className?: string;
}

const sizeMap = {
  sm: { logo: "h-7 w-7", text: "text-base", tagline: "text-[10px]" },
  md: { logo: "h-8 w-8", text: "text-xl", tagline: "text-xs" },
  lg: { logo: "h-9 w-9", text: "text-base", tagline: "text-[10px]" },
};

const variantStyles = {
  default: {
    wrapper: "",
    logo: "rounded-lg",
    text: "text-slate-900",
    tagline: "text-slate-500",
  },
  sidebar: {
    wrapper: "bg-gradient-to-r from-sidebar/50 to-transparent",
    logo: "rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm shadow-lg",
    text: "text-white",
    tagline: "text-white/70",
  },
  light: {
    wrapper: "",
    logo: "rounded-lg border border-emerald-100",
    text: "text-slate-900",
    tagline: "text-slate-500",
  },
};

export const BrandLogo = ({
  size = "md",
  showText = true,
  showTagline = false,
  showStatusDot = false,
  variant = "default",
  className,
}: BrandLogoProps) => {
  const s = sizeMap[size];
  const v = variantStyles[variant];

  return (
    <div className={cn("flex items-center gap-3", v.wrapper, className)}>
      <div className="relative shrink-0">
        <img
          src={brand.logoPath}
          alt={brand.appName}
          className={cn(s.logo, "shrink-0 object-contain", v.logo)}
        />
        {showStatusDot && (
          <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-sidebar shadow-sm" />
        )}
      </div>
      {(showText || showTagline) && (
        <div className="min-w-0 flex-1">
          {showText && (
            <p className={cn("truncate font-bold leading-tight tracking-tight", s.text, v.text)}>
              {brand.appName}
            </p>
          )}
          {showTagline && (
            <p className={cn("truncate font-medium uppercase tracking-widest", s.tagline, v.tagline)}>
              {brand.tagline}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
