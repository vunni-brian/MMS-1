import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, setSessionToken } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <div className="absolute left-8 top-8">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold font-heading">MMS</span>
        </button>
      </div>

      <div className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Login Page</p>
          <h1 className="text-3xl font-bold text-slate-900 font-heading">Welcome Back</h1>
          <p className="mt-2 text-slate-500">Sign in to your account</p>
        </div>

        <div className="mb-8 flex border-b border-slate-200">
          <button
            type="button"
            className={cn(
              "flex-1 pb-3 text-sm font-medium transition-colors relative",
              !requiresOtp ? "text-primary border-b-2 border-primary" : "text-slate-500 hover:text-slate-700"
            )}
            onClick={requiresOtp ? (isMfaStep ? handleResetMfa : handleBackToLogin) : undefined}
          >
            Login
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 pb-3 text-sm font-medium transition-colors relative",
              requiresOtp ? "text-primary border-b-2 border-primary" : "text-slate-500 cursor-default opacity-60"
            )}
          >
            Verify OTP
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {!requiresOtp ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-600 font-medium text-sm">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+256 7XX XXX XXX"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setPageError(null);
                  }}
                  autoComplete="tel"
                  className="h-12 bg-slate-50/50 border-slate-200"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-600 font-medium text-sm">Password</Label>
                <div className="relative">
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
                    className="h-12 bg-slate-50/50 border-slate-200 pr-10"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button type="button" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-4">
                  Enter the six-digit code sent to <br /><span className="font-semibold text-slate-900">{phone.trim() || "your registered phone number"}</span>
                </p>
                <div className="flex justify-center">
                  <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isLoading} />
                </div>
              </div>
            </div>
          )}

          {(pageError || authError) && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {pageError || authError}
            </div>
          )}

          <Button className="h-12 w-full text-base font-semibold" type="submit" disabled={isLoading || !canSubmit}>
            {requiresOtp ? "Verify" : "Login"}
          </Button>

          <div className="text-center pt-2">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <button type="button" onClick={() => navigate("/register")} className="font-semibold text-primary hover:underline">
                Register as Vendor
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
