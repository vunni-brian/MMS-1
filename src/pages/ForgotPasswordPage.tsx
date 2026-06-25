/**
 * Forgot password page with phone-based password reset flow.
 * Supports phone entry, OTP verification, and new password creation steps.
 * Public access (no authentication required).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

/** ForgotPasswordPage - renders the phone-based password reset flow with steps for phone entry, OTP verification, and new password creation. */
const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  /** Sends password reset OTP code to the provided phone number. */
  const handleSendResetCode = async () => {
    setPageError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data?.error || "Request failed.", response.status, data?.details);
      }
      setChallengeId(data.challengeId);
      setStep("otp");
    } catch (error) {
      setPageError(error instanceof ApiError ? error.message : t("auth:continueError"));
    } finally {
      setIsLoading(false);
    }
  };

  /** Validates and submits the new password along with the OTP to complete the password reset. */
  const handleResetPassword = async () => {
    setPageError(null);
    if (newPassword !== confirmNewPassword) {
      setPageError(t("auth:passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPageError(t("auth:passwordMinLength"));
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: otp.trim(), newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data?.error || "Request failed.", response.status, data?.details);
      }
      setStep("success");
    } catch (error) {
      setPageError(error instanceof ApiError ? error.message : t("auth:continueError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "phone") void handleSendResetCode();
    else if (step === "otp") void handleResetPassword();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BrandLogo variant="light" size="md" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-slate-600 hover:text-emerald-600">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("auth:backToHome")}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("auth:secureAccess")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {step === "success" ? t("auth:passwordResetSuccess") : t("auth:forgotPassword")}
            </h1>
            <p className="mt-2 text-slate-600">
              {step === "phone" && t("auth:forgotPasswordSubtitle")}
              {step === "otp" && t("auth:otpSubtitle")}
              {step === "success" && t("auth:passwordResetSuccessSubtitle")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="p-8">
              {step !== "success" ? (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {step === "phone" && (
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-900 font-semibold">{t("auth:phoneNumber")}</Label>
                      <Input
                        id="phone"
                        placeholder={t("auth:phonePlaceholder")}
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPageError(null); }}
                        autoComplete="tel"
                        className="h-12 rounded-lg border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        required
                      />
                    </div>
                  )}

                  {step === "otp" && (
                    <>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <div className="text-sm text-slate-700">
                          <p className="mb-1 font-semibold text-emerald-900">{t("auth:otpSentTitle")}</p>
                          <p>{t("auth:otpSent", { phone: phone.trim() })}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="otp" className="text-slate-900 font-semibold">{t("auth:otpCode")}</Label>
                        <Input
                          id="otp"
                          placeholder={t("auth:otpPlaceholder")}
                          value={otp}
                          onChange={(e) => { setOtp(e.target.value); setPageError(null); }}
                          autoComplete="one-time-code"
                          className="h-12 rounded-lg border-slate-200 text-center font-mono tracking-[0.3em] focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                          required
                          maxLength={6}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-slate-900 font-semibold">{t("auth:newPassword")}</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            placeholder={t("auth:newPasswordPlaceholder")}
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setPageError(null); }}
                            autoComplete="new-password"
                            className="h-12 rounded-lg border-slate-200 pr-10 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                            required
                          />
                          <button
                            type="button"
                            aria-label={showNewPassword ? t("auth:hidePassword") : t("auth:showPassword")}
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmNewPassword" className="text-slate-900 font-semibold">{t("auth:confirmNewPassword")}</Label>
                        <div className="relative">
                          <Input
                            id="confirmNewPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder={t("auth:confirmNewPasswordPlaceholder")}
                            value={confirmNewPassword}
                            onChange={(e) => { setConfirmNewPassword(e.target.value); setPageError(null); }}
                            autoComplete="new-password"
                            className="h-12 rounded-lg border-slate-200 pr-10 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                            required
                          />
                          <button
                            type="button"
                            aria-label={showConfirmPassword ? t("auth:hidePassword") : t("auth:showPassword")}
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {pageError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>
                  )}

                  <Button
                    className="h-12 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
                    type="submit"
                    disabled={
                      isLoading ||
                      (step === "phone" && !phone.trim()) ||
                      (step === "otp" && (!otp.trim() || !newPassword || !confirmNewPassword))
                    }
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {t("auth:processing")}
                      </span>
                    ) : step === "phone" ? (
                      t("auth:sendResetCode")
                    ) : (
                      t("auth:resetPassword")
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center py-4 text-center">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <p className="text-slate-600">{t("auth:passwordResetSuccessDescription")}</p>
                  </div>
                  <Button
                    className="h-12 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
                    onClick={() => navigate("/login")}
                  >
                    {t("auth:returnToLogin")}
                  </Button>
                </div>
              )}
            </div>

            {step !== "success" && (
              <div className="border-t border-slate-100 px-8 py-6">
                <p className="text-center text-sm text-slate-600">
                  {t("auth:rememberPassword")}{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    {t("auth:signIn")}
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <a href="/terms" className="transition-colors hover:text-emerald-600">{t("auth:termsOfService")}</a>
              <span>&bull;</span>
              <a href="/privacy" className="transition-colors hover:text-emerald-600">{t("auth:privacyPolicy")}</a>
              <span>&bull;</span>
              <a href="/security" className="transition-colors hover:text-emerald-600">{t("auth:security")}</a>
            </div>
            <p className="mt-4 text-xs text-slate-400">{t("auth:copyright")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
