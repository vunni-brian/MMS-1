import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Store, Upload } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RegistrationStep = "form" | "otp" | "done";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegistrationStep>("form");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    marketId: "",
    idFile: null as File | null,
  });
  const [otp, setOtp] = useState("");
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "public-registration"],
    queryFn: () => api.getMarkets(),
  });

  useEffect(() => {
    if (!form.marketId && marketsData?.markets.length) {
      setForm((current) => ({ ...current, marketId: marketsData.markets[0].id }));
    }
  }, [form.marketId, marketsData?.markets]);

  const updateField = <Key extends keyof typeof form>(field: Key, value: (typeof form)[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePrimaryAction = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (step === "form") {
        if (!form.idFile) {
          throw new Error("An ID document is required.");
        }
        const response = await api.registerVendor({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          marketId: form.marketId,
          idDocument: form.idFile,
        });
        setChallengeId(response.challengeId);
        setStep("otp");
        return;
      }

      if (!challengeId) {
        throw new Error("Registration challenge not found. Restart the registration flow.");
      }

      await api.verifyRegistrationOtp(challengeId, otp);
      setStep("done");
    } catch (error) {
      setError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to complete registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handlePrimaryAction();
  };

  const canSubmit =
    step === "form"
      ? Boolean(form.name.trim() && form.email.trim() && form.phone.trim() && form.password && form.marketId && form.idFile)
      : otp.length === 6 && Boolean(challengeId);

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="card-warm w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold font-heading">Registration Submitted</h2>
            <p className="text-muted-foreground text-sm">
              Your phone number is verified and your vendor profile is now pending manager approval.
            </p>
            <Button onClick={() => navigate("/login")} variant="outline">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Vendor Registration</h1>
          <p className="text-muted-foreground text-sm">
            {step === "form" ? "Create your vendor profile and submit your ID document" : "Verify the OTP sent to your phone"}
          </p>
        </div>

        <Card className="card-warm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading">{step === "form" ? "Vendor details" : "Phone verification"}</CardTitle>
            <CardDescription>Step {step === "form" ? "1" : "2"} of 2</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {step === "form" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+256 7XX XXX XXX"
                      value={form.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="market">Market</Label>
                    <Select value={form.marketId} onValueChange={(value) => updateField("marketId", value)}>
                      <SelectTrigger id="market">
                        <SelectValue placeholder="Select your market" />
                      </SelectTrigger>
                      <SelectContent>
                        {(marketsData?.markets || []).map((market) => (
                          <SelectItem key={market.id} value={market.id}>
                            {market.name} ({market.location})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ID Document (PDF/JPG/PNG, max 5MB)</Label>
                    <label className="block border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/40 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {form.idFile ? form.idFile.name : "Click to choose an ID document"}
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(event) => updateField("idFile", event.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
                    Enter the verification code sent to <span className="font-medium text-foreground">{form.phone}</span>.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP Code</Label>
                    <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isSubmitting} />
                  </div>
                </div>
              )}

              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (step === "form") {
                      navigate("/login");
                    } else {
                      setStep("form");
                      setOtp("");
                    }
                  }}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || !canSubmit}>
                  {step === "form" ? "Send OTP" : "Verify & Submit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
