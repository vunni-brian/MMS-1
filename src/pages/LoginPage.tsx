import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Phone, Shield, ShieldCheck } from "lucide-react";

import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, setSessionToken } from "@/lib/api";

const LoginPage = () => {
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
  const canSubmit = isMfaStep || isVendorVerificationStep ? otp.length === 6 : Boolean(phone.trim() && password);

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
      setPageError(error instanceof ApiError ? error.message : "Unable to continue sign-in.");
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

  const title = isMfaStep ? "Verify Access" : isVendorVerificationStep ? "Verify Phone" : "Welcome Back";
  const subtitle = isMfaStep
    ? "Enter the code sent to your registered phone number."
    : isVendorVerificationStep
      ? "Finish phone verification for your vendor account."
      : "Sign in to your market workspace.";

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-bold font-heading">WMMS</span>
        </button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/register")}>
          Register
        </Button>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-82px)] max-w-6xl items-center gap-6 py-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] sm:p-7 lg:p-8">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase text-primary">Login Page</p>
            <h1 className="mt-2 text-2xl font-bold font-heading">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isMfaStep && !isVendorVerificationStep ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="phone"
                      placeholder="+256 7XX XXX XXX"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setPageError(null);
                      }}
                      autoComplete="tel"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" className="text-xs font-semibold text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setPageError(null);
                      }}
                      autoComplete="current-password"
                      className="pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex w-fit items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary" />
                  Remember me
                </label>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-amber-800">
                    <Shield className="h-4 w-4" />
                    {isMfaStep ? "MFA required for this account" : "Vendor phone verification"}
                  </div>
                  <p className="mt-1 text-amber-900/75">
                    Enter the six-digit code sent to <span className="font-semibold text-amber-950">{phone.trim() || "your registered phone number"}</span>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP Code</Label>
                  <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isLoading} />
                </div>
              </>
            )}

            {(pageError || authError) && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {pageError || authError}
              </div>
            )}

            <Button className="h-11 w-full gap-2" type="submit" disabled={isLoading || !canSubmit}>
              {isMfaStep ? "Verify MFA" : isVendorVerificationStep ? "Verify Phone" : "Login"}
              {!isMfaStep && !isVendorVerificationStep && <ArrowRight className="h-4 w-4" />}
            </Button>

            <div className="flex items-center justify-between gap-3 text-sm">
              {!isMfaStep && !isVendorVerificationStep ? (
                <p className="text-slate-600">
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => navigate("/register")} className="font-semibold text-primary hover:underline">
                    Register as Vendor
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={isMfaStep ? handleResetMfa : handleBackToLogin}
                  className="font-semibold text-primary hover:underline"
                >
                  Back to login
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="relative hidden min-h-[560px] overflow-hidden rounded-lg border border-white bg-slate-900 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.75)] lg:block">
          <img src="/images/market-hero.jpg" alt="Market stalls" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/78 via-primary/54 to-transparent" />
          <div className="absolute inset-x-8 bottom-8 rounded-lg border border-white/20 bg-white/90 p-5 text-slate-950 shadow-xl backdrop-blur">
            <p className="text-xs font-semibold uppercase text-primary">Efficient management</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight font-heading">Better market decisions from one workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Join vendors, managers, officials, and administrators using WMMS to keep daily operations visible.</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoginPage;
