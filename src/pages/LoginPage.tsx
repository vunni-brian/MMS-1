import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, setSessionToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const LoginPage = () => {
  const { t } = useTranslation();
  const { user, login, verifyPrivilegedMfa, pendingMfa, clearPendingMfa, isLoading, authError, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingVendorVerification, setPendingVendorVerification] = useState<{
    challengeId: string;
    expiresAt: string;
  } | null>(null);

  const isMfaStep = Boolean(pendingMfa);
  const isVendorVerificationStep = Boolean(pendingVendorVerification);
  const requiresOtp = isMfaStep || isVendorVerificationStep;
  const canSubmit = requiresOtp ? otp.length === 6 : Boolean(phone.trim() && password);

  useEffect(() => {
    if (user) {
      navigate(from || `/${user.role}`, { replace: true });
    }
  }, [navigate, user, from]);

  const handlePrimaryAction = async () => {
    setPageError(null);
    try {
      if (pendingMfa) {
        await verifyPrivilegedMfa(otp);
        return;
      }

      if (pendingVendorVerification) {
        const response = await api.verifyRegistrationOtp(pendingVendorVerification.challengeId, otp);
        setSessionToken(response.token);
        await refreshUser();
        setPendingVendorVerification(null);
        setOtp("");
        return;
      }

      const response = await login(phone, password);
      if (response.verificationRequired) {
        setPendingVendorVerification({
          challengeId: response.challengeId,
          expiresAt: response.expiresAt,
        });
        setOtp("");
        return;
      }

      if (!response.mfaRequired) {
        setOtp("");
      }
    } catch (error) {
      setPageError(error instanceof ApiError ? error.message : t("auth:continueError"));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handlePrimaryAction();
  };

  const handleResetMfa = () => {
    clearPendingMfa();
    setOtp("");
    setPageError(null);
  };

  const handleBackToLogin = () => {
    clearPendingMfa();
    setPendingVendorVerification(null);
    setOtp("");
    setPageError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      {/* Simple Header - matches landing page style */}
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <BrandLogo variant="light" size="md" />
          </button>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="/#features" className="transition-colors hover:text-emerald-600">{t("auth:features")}</a>
            <a href="/#process" className="transition-colors hover:text-emerald-600">{t("auth:process")}</a>
            <a href="/#reviews" className="transition-colors hover:text-emerald-600">{t("auth:reviews")}</a>
            <a href="/#pricing" className="transition-colors hover:text-emerald-600">{t("auth:pricing")}</a>
            <a href="/#faqs" className="transition-colors hover:text-emerald-600">{t("auth:faqs")}</a>
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-slate-600 hover:text-emerald-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("auth:backToHome")}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          {/* Logo & Header - Clean like landing page */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("auth:secureAccess")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {t("auth:signIn")}
            </h1>
            <p className="mt-2 text-slate-600">
              {t("auth:signInSubtitle")}
            </p>
          </div>

          {/* Main Card - Matches landing page card style */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="p-8">
              {/* Step Indicator - Clean tabs */}
              <div className="mb-8 flex gap-4 border-b border-slate-200">
                <button
                  type="button"
                  className={cn(
                    "pb-3 text-sm font-semibold transition-all relative",
                    !requiresOtp 
                      ? "text-emerald-600 border-b-2 border-emerald-600" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                  onClick={requiresOtp ? (isMfaStep ? handleResetMfa : handleBackToLogin) : undefined}
                  disabled={!requiresOtp}
                >
                  {t("auth:credentials")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "pb-3 text-sm font-semibold transition-all relative",
                    requiresOtp 
                      ? "text-emerald-600 border-b-2 border-emerald-600" 
                      : "text-slate-300 cursor-not-allowed"
                  )}
                  disabled
                >
                  {t("auth:verificationOtp")}
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {!requiresOtp ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-900 font-semibold">
                        {t("auth:phoneNumber")}
                      </Label>
                      <Input
                        id="phone"
                        placeholder={t("auth:phonePlaceholder")}
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          setPageError(null);
                        }}
                        autoComplete="tel"
                        className="h-12 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-slate-900 font-semibold">
                          {t("auth:password")}
                        </Label>
                        <a 
                          href="/forgot-password" 
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          {t("auth:forgotPassword")}
                        </a>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("auth:passwordPlaceholder")}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setPageError(null);
                          }}
                          autoComplete="current-password"
                          className="h-12 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500 pr-10"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? t("auth:hidePassword") : t("auth:showPassword")}
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-700">
                        <p className="font-semibold text-emerald-900 mb-1">{t("auth:verificationRequired")}</p>
                        <p>
                          {t("auth:otpSent", { phone: phone.trim() })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-center py-4">
                      <OtpCodeInput 
                        id="otp" 
                        value={otp} 
                        onChange={setOtp} 
                        disabled={isLoading}
                        className="gap-3"
                      />
                    </div>
                  </div>
                )}

                {(pageError || authError) && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {pageError || authError}
                  </div>
                )}

                <Button 
                  className="h-12 w-full text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all hover:shadow-md" 
                  type="submit" 
                  disabled={isLoading || !canSubmit}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t("auth:processing")}
                    </div>
                  ) : (
                    requiresOtp ? t("auth:verifyButton") : t("auth:signInButton")
                  )}
                </Button>
              </form>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 px-8 py-6">
              <p className="text-center text-sm text-slate-600">
                {t("auth:needAccount")}{" "}
                <button 
                  type="button" 
                  onClick={() => navigate("/register")} 
                  className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {t("auth:registerLink")}
                </button>
              </p>
            </div>
          </div>

          {/* Footer Links - Matches landing page */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <a href="#" className="hover:text-emerald-600 transition-colors">{t("auth:termsOfService")}</a>
              <span>•</span>
              <a href="#" className="hover:text-emerald-600 transition-colors">{t("auth:privacyPolicy")}</a>
              <span>•</span>
              <a href="#" className="hover:text-emerald-600 transition-colors">{t("auth:security")}</a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {t("auth:copyright")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
