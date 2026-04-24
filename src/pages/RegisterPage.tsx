import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, setSessionToken } from "@/lib/api";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Button } from "@/components/ui/button";
import { FileUploadCard, FormSection } from "@/components/console/ConsolePage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RegistrationStep = "details" | "documents" | "otp";

const formatFileLabel = (file: File | null) => {
  if (!file) {
    return "No file selected";
  }
  return `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
};

const productSections = ["Fresh Produce", "Textiles", "Cooked Food", "Electronics", "Household Goods", "Crafts", "Services", "Other"];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<RegistrationStep>("details");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    marketId: "",
    nationalIdNumber: "",
    district: "",
    productSection: "",
    profileImage: null as File | null,
    idFile: null as File | null,
    lcLetterFile: null as File | null,
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

  useEffect(() => {
    const selectedMarket = marketsData?.markets.find((market) => market.id === form.marketId);
    if (selectedMarket && !form.district.trim()) {
      setForm((current) => ({ ...current, district: selectedMarket.location }));
    }
  }, [form.district, form.marketId, marketsData?.markets]);

  const updateField = <Key extends keyof typeof form>(field: Key, value: (typeof form)[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePrimaryAction = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (step === "details") {
        setStep("documents");
        return;
      }

      if (step === "documents") {
        if (!form.idFile) {
          throw new Error("A National ID document is required.");
        }
        if (!form.lcLetterFile) {
          throw new Error("An LC Letter is required.");
        }
        const response = await api.registerVendor({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          marketId: form.marketId,
          nationalIdNumber: form.nationalIdNumber,
          district: form.district,
          productSection: form.productSection,
          profileImage: form.profileImage,
          idDocument: form.idFile,
          lcLetter: form.lcLetterFile,
        });
        setChallengeId(response.challengeId);
        setStep("otp");
        return;
      }

      if (!challengeId) {
        throw new Error("Registration challenge not found. Restart the registration flow.");
      }

      const response = await api.verifyRegistrationOtp(challengeId, otp);
      setSessionToken(response.token);
      await refreshUser();
      navigate("/vendor", { replace: true });
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
    step === "details"
      ? Boolean(
          form.name.trim() &&
            form.email.trim() &&
            form.phone.trim() &&
            form.password &&
            form.marketId &&
            form.nationalIdNumber.trim() &&
            form.district.trim() &&
            form.productSection,
        )
      : step === "documents"
      ? Boolean(
          form.idFile &&
            form.lcLetterFile,
        )
      : otp.length === 6 && Boolean(challengeId);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-muted mb-2">
            <Store className="w-7 h-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Vendor Registration</h1>
          <p className="text-muted-foreground text-sm">
            {step === "details"
              ? "Enter your account and vendor details first"
              : step === "documents"
                ? "Upload your verification documents"
                : "Verify the OTP sent to your phone"}
          </p>
        </div>

        <Card className="card-warm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading">
              {step === "details" ? "Vendor details" : step === "documents" ? "Document upload" : "Phone verification"}
            </CardTitle>
            <CardDescription>Step {step === "details" ? "1" : step === "documents" ? "2" : "3"} of 3</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {step === "details" ? (
                <FormSection
                  title="Vendor Details"
                  description="Account identity, market assignment, and profile photo used by managers during review."
                  className="shadow-none"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FileUploadCard
                      id="profile-photo"
                      label="Profile Photo"
                      description="Shown on your profile and in the manager vendor directory."
                      accept="image/*"
                      value={formatFileLabel(form.profileImage)}
                      className="md:col-span-2"
                      onChange={(file) => updateField("profileImage", file)}
                    />
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(event) => updateField("name", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="national-id-number">NIN / ID Number</Label>
                      <Input
                        id="national-id-number"
                        value={form.nationalIdNumber}
                        onChange={(event) => updateField("nationalIdNumber", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="district">District</Label>
                      <Input
                        id="district"
                        value={form.district}
                        onChange={(event) => updateField("district", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="product-section">Product Section</Label>
                      <Select value={form.productSection} onValueChange={(value) => updateField("productSection", value)}>
                        <SelectTrigger id="product-section">
                          <SelectValue placeholder="Select product section" />
                        </SelectTrigger>
                        <SelectContent>
                          {productSections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <div className="space-y-1.5 md:col-span-2">
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
                  </div>
                </FormSection>
              ) : step === "documents" ? (
                <FormSection
                  title="Document Upload"
                  description="Upload a National ID and LC Letter for manager verification. Files must be PDF, JPG, JPEG, or PNG."
                  className="shadow-none"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FileUploadCard
                      id="national-id-upload"
                      label="National ID"
                      description="Primary identity document."
                      accept=".pdf,.jpg,.jpeg,.png"
                      value={formatFileLabel(form.idFile)}
                      onChange={(file) => updateField("idFile", file)}
                    />
                    <FileUploadCard
                      id="national-id-camera"
                      label="Take National ID Photo"
                      description="Use the device camera when registering on mobile."
                      accept="image/*"
                      capture="environment"
                      value={formatFileLabel(form.idFile)}
                      onChange={(file) => updateField("idFile", file)}
                    />
                    <div className="md:col-span-2">
                      <FileUploadCard
                        id="lc-letter-upload"
                        label="LC Letter"
                        description="Proof of residence in the selected district."
                        accept=".pdf,.jpg,.jpeg,.png"
                        value={formatFileLabel(form.lcLetterFile)}
                        onChange={(file) => updateField("lcLetterFile", file)}
                      />
                    </div>
                  </div>
                </FormSection>
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
                    if (step === "details") {
                      navigate("/login");
                    } else if (step === "documents") {
                      setStep("details");
                    } else {
                      setStep("documents");
                      setOtp("");
                    }
                  }}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || !canSubmit}>
                  {step === "details" ? "Continue to Documents" : step === "documents" ? "Send OTP" : "Verify & Open Dashboard"}
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
