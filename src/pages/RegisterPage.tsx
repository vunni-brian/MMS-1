import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Sparkles, Store } from "lucide-react";

import { BrandLogo } from "@/components/ui/BrandLogo";
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
type DetailField = "name" | "nationalIdNumber" | "phone" | "email" | "password" | "marketId" | "productSection" | "district";

const detailFields: DetailField[] = ["name", "nationalIdNumber", "phone", "email", "password", "marketId", "productSection", "district"];

const productSections = ["Fresh Produce", "Textiles", "Cooked Food", "Electronics", "Household Goods", "Crafts", "Services", "Other"];

const formatFileLabel = (t: (key: string) => string, file: File | null) => {
 if (!file) {
 return t("register:noFileSelected") || "No file selected";
 }
 return `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
};

const registrationSteps = (t: (key: string) => string): Array<{ id: RegistrationStep; label: string; description: string }> => [
 { id: "details", label: t("register:stepAccount"), description: t("register:stepAccountDesc") },
 { id: "documents", label: t("register:stepDocuments"), description: t("register:stepDocumentsDesc") },
 { id: "otp", label: t("register:stepVerify"), description: t("register:stepVerifyDesc") },
];

const validatePhone = (t: (key: string) => string, phone: string) => {
 const cleaned = phone.replace(/\s/g, "");
 if (!cleaned) return t("register:phoneRequired");
 if (!/^\+?\d{9,15}$/.test(cleaned)) return t("register:phoneInvalid");
 return null;
};

const validateEmail = (t: (key: string) => string, email: string) => {
 if (!email.trim()) return t("register:emailRequired");
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t("register:emailInvalid");
 return null;
};

const getPasswordStrength = (t: (key: string) => string, password: string): { score: number; label: string; color: string } => {
 if (!password) return { score: 0, label: "", color: "" };
 let score = 0;
 if (password.length >= 8) score++;
 if (password.length >= 12) score++;
 if (/[A-Z]/.test(password)) score++;
 if (/[0-9]/.test(password)) score++;
 if (/[^A-Za-z0-9]/.test(password)) score++;
 if (score <= 1) return { score, label: t("register:passwordWeak"), color: "bg-red-500" };
 if (score <= 3) return { score, label: t("register:passwordFair"), color: "bg-yellow-500" };
 return { score, label: t("register:passwordStrong"), color: "bg-emerald-500" };
};

const RegisterPage = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { refreshUser } = useAuth();
 const [step, setStep] = useState<RegistrationStep>("details");
 const [challengeId, setChallengeId] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [fieldErrors, setFieldErrors] = useState<Partial<Record<DetailField, string>>>({});
 const [touched, setTouched] = useState<Partial<Record<DetailField, boolean>>>({});
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
 setFieldErrors((prev) => ({ ...prev, marketId: undefined }));
 }
 }, [form.marketId, marketsData?.markets]);

 useEffect(() => {
 const selectedMarket = marketsData?.markets.find((market) => market.id === form.marketId);
 if (selectedMarket && !form.district.trim()) {
 setForm((current) => ({ ...current, district: selectedMarket.location }));
 setFieldErrors((prev) => ({ ...prev, district: undefined }));
 }
 }, [form.district, form.marketId, marketsData?.markets]);

 const updateField = <Key extends keyof typeof form>(field: Key, value: (typeof form)[Key]) => {
 setForm((current) => ({ ...current, [field]: value }));
 };

 const touch = (field: DetailField) =>
 setTouched((prev) => ({ ...prev, [field]: true }));

  const validateDetails = () => {
   const errors: Partial<Record<DetailField, string>> = {};
   const phoneErr = validatePhone(t, form.phone);
   if (phoneErr) errors.phone = phoneErr;
   const emailErr = validateEmail(t, form.email);
   if (emailErr) errors.email = emailErr;
   if (!form.password) errors.password = t("register:passwordRequired");
   else if (form.password.length < 8) errors.password = t("register:passwordMinLength");
   if (!form.name.trim()) errors.name = t("register:nameRequired");
   if (!form.nationalIdNumber.trim()) errors.nationalIdNumber = t("register:ninRequired");
   if (!form.marketId) errors.marketId = t("register:marketRequired");
   if (!form.district.trim()) errors.district = t("register:districtRequired");
   if (!form.productSection) errors.productSection = t("register:productSectionRequired");
 setFieldErrors(errors);
 const isValid = Object.keys(errors).length === 0;
 if (!isValid) {
 setTouched((prev) => detailFields.reduce((next, field) => ({ ...next, [field]: true }), prev));
 }
 return isValid;
 };

 const handlePrimaryAction = async () => {
 setError(null);
 setIsSubmitting(true);
 try {
 if (step === "details") {
 if (!validateDetails()) {
 setIsSubmitting(false);
 return;
 }
 setStep("documents");
 return;
 }

    if (step === "documents") {
     if (!form.idFile) {
      throw new Error(t("register:idRequired"));
     }
     if (!form.lcLetterFile) {
      throw new Error(t("register:lcLetterRequired"));
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
    throw new Error(t("register:challengeNotFound"));
   }

 const response = await api.verifyRegistrationOtp(challengeId, otp);
 setSessionToken(response.token);
 await refreshUser();
 navigate("/vendor", { replace: true });
 } catch (error) {
   setError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : t("register:unableToComplete"));
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
 ? true
 : step === "documents"
 ? Boolean(form.idFile && form.lcLetterFile)
 : otp.length === 6 && Boolean(challengeId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      {/* Header - Matching landing page */}
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
            onClick={() => navigate("/login")}
            className="text-slate-600 hover:text-emerald-600"
          >
            {t("auth:login")}
          </Button>
        </div>
      </header>

      <main className="mx-auto grid flex-1 w-full max-w-6xl items-center gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:grid-cols-[0.72fr_1.28fr]">
        {/* Left Side - Image Card (KEPT ORIGINAL LAYOUT) */}
        <aside className="hidden overflow-hidden rounded-2xl border border-emerald-100 bg-slate-900 shadow-2xl lg:block">
          <div className="relative min-h-[640px]">
            <img src="/images/market-hero.jpg" alt="Market walkway" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/60 to-emerald-900/80" />
            <div className="absolute left-6 right-6 top-6 rounded-2xl border border-white/20 bg-white/95 p-6 backdrop-blur-xl shadow-2xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg">
                <Store className="h-6 w-6" />
              </span>
              <h1 className="mt-6 text-3xl font-bold leading-tight font-heading text-slate-950">{t("register:title")}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t("register:heroDesc")}
              </p>
            </div>
          </div>
        </aside>

        {/* Right Side - Registration Card (Theme changed to green) */}
        <Card className="rounded-2xl border-emerald-100 shadow-lg bg-white/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-heading text-slate-900">
              {step === "details" ? t("register:vendorDetails") : step === "documents" ? t("register:documentUpload") : t("register:phoneVerification")}
            </CardTitle>
            <CardDescription>{t("register:stepCounter", { current: step === "details" ? "1" : step === "documents" ? "2" : "3" })}</CardDescription>
            <div className="mt-4 grid gap-2 grid-cols-3">
              {registrationSteps(t).map((item, index) => {
                const activeIndex = registrationSteps.findIndex((candidate) => candidate.id === step);
                const isComplete = index < activeIndex;
                const isActive = item.id === step;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-3 py-2 transition-all ${
                      isActive
                        ? "border-emerald-400 bg-emerald-50"
                        : isComplete
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className={`text-xs font-semibold ${isActive ? "text-emerald-700" : isComplete ? "text-emerald-600" : "text-slate-600"}`}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              {step === "details" ? (
                <FormSection
                  title={t("register:accountMarketDetails")}
                  description={t("register:accountMarketDesc")}
                  className="shadow-none"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-slate-900 font-semibold">{t("register:fullName")}</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(event) => updateField("name", event.target.value)}
                        onBlur={() => touch("name")}
                        className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        required
                      />
                      {touched.name && fieldErrors.name && (
                        <p className="text-xs text-red-600">{fieldErrors.name}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="national-id-number" className="text-slate-900 font-semibold">{t("register:nin")}</Label>
                      <Input
                        id="national-id-number"
                        value={form.nationalIdNumber}
                        onChange={(event) => updateField("nationalIdNumber", event.target.value)}
                        onBlur={() => touch("nationalIdNumber")}
                        className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        required
                      />
                      {touched.nationalIdNumber && fieldErrors.nationalIdNumber && (
                        <p className="text-xs text-red-600">{fieldErrors.nationalIdNumber}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-slate-900 font-semibold">{t("register:phoneNumber")}</Label>
                      <Input
                        id="phone"
                        placeholder={t("register:phonePlaceholder")}
                        value={form.phone}
                        onChange={(event) => {
                          updateField("phone", event.target.value);
                          if (touched.phone) {
                            const err = validatePhone(event.target.value);
                            setFieldErrors((prev) => ({ ...prev, phone: err ?? undefined }));
                          }
                        }}
                        onBlur={() => {
                          touch("phone");
                          const err = validatePhone(form.phone);
                          setFieldErrors((prev) => ({ ...prev, phone: err ?? undefined }));
                        }}
                        className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        autoComplete="tel"
                        required
                      />
                      {touched.phone && fieldErrors.phone && (
                        <p className="text-xs text-red-600">{fieldErrors.phone}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-slate-900 font-semibold">{t("register:emailAddress")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => {
                          updateField("email", event.target.value);
                          if (touched.email) {
                            const err = validateEmail(event.target.value);
                            setFieldErrors((prev) => ({ ...prev, email: err ?? undefined }));
                          }
                        }}
                        onBlur={() => {
                          touch("email");
                          const err = validateEmail(form.email);
                          setFieldErrors((prev) => ({ ...prev, email: err ?? undefined }));
                        }}
                        className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        autoComplete="email"
                        required
                      />
                      {touched.email && fieldErrors.email && (
                        <p className="text-xs text-red-600">{fieldErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="password" className="text-slate-900 font-semibold">{t("register:password")}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(event) => {
                            updateField("password", event.target.value);
                            if (touched.password) {
                              const err = event.target.value.length < 8 ? t("register:passwordMinLength") : undefined;
                              setFieldErrors((prev) => ({ ...prev, password: err }));
                            }
                          }}
                          onBlur={() => {
                            touch("password");
                            const err = form.password.length < 8 ? t("register:passwordMinLength") : undefined;
                            setFieldErrors((prev) => ({ ...prev, password: err }));
                          }}
                          className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500 pr-10"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? t("register:hidePassword") : t("register:showPassword")}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {form.password && (() => {
                        const strength = getPasswordStrength(t, form.password);
                        return (
                          <div className="space-y-1">
                            <div className="flex h-1.5 gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className={`h-full flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-slate-200"}`}
                                />
                              ))}
                            </div>
                            <p className={`text-xs font-medium ${
                              strength.score <= 1 ? "text-red-600" : strength.score <= 3 ? "text-yellow-600" : "text-emerald-600"
                            }`}>
                              {strength.label}
                            </p>
                          </div>
                        );
                      })()}
                      {touched.password && fieldErrors.password && (
                        <p className="text-xs text-red-600">{fieldErrors.password}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="market" className="text-slate-900 font-semibold">{t("register:market")}</Label>
                      <Select
                        value={form.marketId}
                        onValueChange={(value) => {
                          updateField("marketId", value);
                          touch("marketId");
                          setFieldErrors((prev) => ({ ...prev, marketId: undefined }));
                        }}
                      >
                        <SelectTrigger id="market" className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500">
                          <SelectValue placeholder={t("register:marketPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(marketsData?.markets || []).map((market) => (
                            <SelectItem key={market.id} value={market.id}>
                              {market.name} ({market.location})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {touched.marketId && fieldErrors.marketId && (
                        <p className="text-xs text-red-600">{fieldErrors.marketId}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="product-section" className="text-slate-900 font-semibold">{t("register:productSection")}</Label>
                      <Select
                        value={form.productSection}
                        onValueChange={(value) => {
                          updateField("productSection", value);
                          touch("productSection");
                          setFieldErrors((prev) => ({ ...prev, productSection: undefined }));
                        }}
                      >
                        <SelectTrigger id="product-section" className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500">
                          <SelectValue placeholder={t("register:productSectionPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {productSections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {touched.productSection && fieldErrors.productSection && (
                        <p className="text-xs text-red-600">{fieldErrors.productSection}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <Label htmlFor="district" className="text-slate-900 font-semibold">{t("register:operatingDistrict")}</Label>
                        {form.district && (
                          <span className="text-[11px] text-emerald-600">{t("register:autoFilledDistrict")}</span>
                        )}
                      </div>
                      <Input
                        id="district"
                        value={form.district}
                        onChange={(event) => updateField("district", event.target.value)}
                        onBlur={() => touch("district")}
                        className="h-11 border-slate-200 rounded-lg focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                        required
                      />
                      {touched.district && fieldErrors.district && (
                        <p className="text-xs text-red-600">{fieldErrors.district}</p>
                      )}
                    </div>
                  </div>
                </FormSection>
              ) : step === "documents" ? (
                <FormSection
                  title={t("register:documentUpload")}
                  description={t("register:documentUploadDesc")}
                  className="shadow-none"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FileUploadCard
                      id="national-id-upload"
                      label={t("register:nationalId")}
                      description={t("register:nationalIdDesc")}
                      accept=".pdf,.jpg,.jpeg,.png"
                      value={formatFileLabel(t, form.idFile)}
                      onChange={(file) => updateField("idFile", file)}
                    />
                    <FileUploadCard
                      id="lc-letter-upload"
                      label={t("register:lcLetter")}
                      description={t("register:lcLetterDesc")}
                      accept=".pdf,.jpg,.jpeg,.png"
                      value={formatFileLabel(t, form.lcLetterFile)}
                      onChange={(file) => updateField("lcLetterFile", file)}
                    />
                    <FileUploadCard
                      id="profile-photo"
                      label={t("register:profilePhoto")}
                      description={t("register:profilePhotoDesc")}
                      accept="image/*"
                      value={formatFileLabel(t, form.profileImage)}
                      className="md:col-span-2"
                      onChange={(file) => updateField("profileImage", file)}
                    />
                  </div>
                </FormSection>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
                    {t("register:otpSent", { phone: form.phone })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-slate-900 font-semibold">{t("register:otpCode")}</Label>
                    <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isSubmitting} />
                  </div>
                </div>
              )}

              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
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
                  className="w-full sm:flex-1 border-slate-200 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t("common:back")}
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all hover:shadow-md" 
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t("register:processing")}
                    </div>
                  ) : (
                    step === "details" ? t("register:continueToVerification") : step === "documents" ? t("register:sendOtp") : t("register:verifyAndOpen")
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RegisterPage;