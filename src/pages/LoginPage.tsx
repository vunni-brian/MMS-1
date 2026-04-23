import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, setSessionToken } from "@/lib/api";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const { user, login, verifyPrivilegedMfa, pendingMfa, clearPendingMfa, isLoading, authError, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
      navigate(`/${user.role}`, { replace: true });
    }
  }, [navigate, user]);

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-muted mb-2">
            <Store className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Market Management System</h1>
          <p className="text-muted-foreground text-sm">
            {pendingMfa
              ? "Privileged account MFA verification"
              : isVendorVerificationStep
                ? "Complete your vendor phone verification"
                : "Sign in with your registered credentials"}
          </p>
        </div>

        <Card className="card-warm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading">
              {isMfaStep ? "Verify privileged access" : isVendorVerificationStep ? "Verify vendor phone number" : "Account sign-in"}
            </CardTitle>
            <CardDescription>
              {isMfaStep
                ? "Enter the OTP sent to your registered phone number"
                : isVendorVerificationStep
                  ? "Enter the OTP sent to the phone number linked to your vendor profile"
                  : "Use your phone number and password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!isMfaStep && !isVendorVerificationStep ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+256 7XX XXX XXX"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </>
              ) : isMfaStep ? (
                <>
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-warning">
                      <Shield className="w-4 h-4" />
                      MFA required for this account
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Enter the six-digit code sent to <span className="font-medium text-foreground">{phone.trim() || "your registered phone number"}</span>.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP Code</Label>
                    <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isLoading} />
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                    Enter the six-digit code sent to <span className="font-medium text-foreground">{phone.trim() || "your registered phone number"}</span>.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP Code</Label>
                    <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isLoading} />
                  </div>
                </>
              )}

              {(pageError || authError) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {pageError || authError}
                </div>
              )}

              <Button className="w-full" type="submit" disabled={isLoading || !canSubmit}>
                {isMfaStep ? "Verify MFA" : isVendorVerificationStep ? "Verify Phone" : "Sign In"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                {!isMfaStep && !isVendorVerificationStep ? (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="text-foreground font-medium hover:underline"
                    >
                      Register as vendor
                    </button>
                  </div>
                ) : (
                  <div />
                )}
                {(isMfaStep || isVendorVerificationStep) && (
                  <button
                    type="button"
                    onClick={isMfaStep ? handleResetMfa : handleBackToLogin}
                    className="text-muted-foreground hover:underline"
                  >
                    Back to login
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
