import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const { user, login, verifyManagerMfa, pendingMfa, clearPendingMfa, isLoading, authError } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [navigate, user]);

  const handlePrimaryAction = async () => {
    setPageError(null);
    try {
      if (pendingMfa) {
        await verifyManagerMfa(otp);
        return;
      }

      const response = await login(phone, password);
      if (!response.mfaRequired) {
        setOtp("");
      }
    } catch (error) {
      setPageError(error instanceof ApiError ? error.message : "Unable to continue sign-in.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Market Stall Manager</h1>
          <p className="text-muted-foreground text-sm">
            {pendingMfa ? "Manager MFA verification" : "Sign in with your registered credentials"}
          </p>
        </div>

        <Card className="card-warm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading">{pendingMfa ? "Verify manager access" : "Account sign-in"}</CardTitle>
            <CardDescription>
              {pendingMfa ? "Enter the OTP sent to your registered phone number" : "Use your phone number and password"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pendingMfa ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+256 7XX XXX XXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
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
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-warning">
                    <Shield className="w-4 h-4" />
                    Manager MFA required
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Enter the six-digit code sent to your registered phone number.
                  </p>
                  {pendingMfa.developmentCode && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Development OTP: <span className="font-mono font-medium">{pendingMfa.developmentCode}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="otp">OTP Code</Label>
                  <Input
                    id="otp"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    className="text-center text-lg tracking-[0.4em]"
                  />
                </div>
              </>
            )}

            {(pageError || authError) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {pageError || authError}
              </div>
            )}

            <Button className="w-full" onClick={handlePrimaryAction} disabled={isLoading}>
              {pendingMfa ? "Verify MFA" : "Sign In"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-primary font-medium hover:underline"
              >
                Register as vendor
              </button>
              {pendingMfa && (
                <button
                  type="button"
                  onClick={() => {
                    clearPendingMfa();
                    setOtp("");
                  }}
                  className="text-muted-foreground hover:underline"
                >
                  Back to login
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
