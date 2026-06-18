import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FileUploadCardProps {
  id: string;
  label: string;
  description?: string;
  value?: string;
  accept?: string;
  capture?: boolean | "user" | "environment";
  disabled?: boolean;
  className?: string;
  onChange: (file: File | null) => void;
}

export const FileUploadCard = ({ id, label, description, value, accept, capture, disabled = false, className, onChange }: FileUploadCardProps) => {
  const { t } = useTranslation();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group block rounded-lg border border-dashed border-border/80 bg-muted/10 p-3 transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/40 hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
          {t("console:chooseFile")}
        </span>
      </div>
      <p className="mt-2 truncate rounded-lg bg-background px-2.5 py-1.5 text-xs text-muted-foreground">{value || t("common:noFileSelected")}</p>
      <input
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        disabled={disabled}
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  );
};
