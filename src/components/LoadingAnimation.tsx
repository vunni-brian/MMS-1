import { useTranslation } from "react-i18next";
import Lottie from "lottie-react";

import animationData from "@/assets/loader-animation.json";

interface LoadingAnimationProps {
  label?: string;
  className?: string;
}
export function LoadingAnimation({ label, className }: LoadingAnimationProps) {
  const { t } = useTranslation();
  const displayLabel = label || t("common:loading");

  return (
    <div className={className ?? "flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center text-sm text-muted-foreground"}>
      <div className="w-32 max-w-[40vw] sm:w-40">
        <Lottie animationData={animationData} loop autoplay className="h-full w-full" />
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{displayLabel}</p>
    </div>
  );
}
