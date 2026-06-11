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
 <div className="flex min-h-screen flex-col bg-[#F3F4F6] text-slate-900 font-sans">
 {/* Official Top Bar */}
 <div className="bg-primary px-4 py-2 text-white">
 <div className="mx-auto flex w-full max-w-5xl items-center justify-between text-xs font-medium">
 <div className="flex items-center gap-2">
 <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary">✓</span>
 Secure Government Login
 </div>
 <button type="button" onClick={() => navigate("/")} className="hover:underline">
 Back to Portal
 </button>
 </div>
 </div>

 <div className="flex flex-1 items-center justify-center px-4 py-12">
 <div className="w-full max-w-[480px]">
 {/* Logo Header */}
 <div className="mb-8 flex flex-col items-center text-center">
 <img
   src="/images/mms-logo.svg"
   alt="MMS logo"
   className="mb-4 h-16 w-16 rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
 />
 <h1 className="text-2xl font-bold text-slate-900">Sign In to Your Account</h1>
 <p className="mt-2 text-sm text-slate-600">Access the MMS Market Management System</p>
 </div>

 <div className="bg-white border border-slate-200 shadow-sm p-8">
 <div className="mb-6 flex border-b border-slate-200">
 <button
 type="button"
 className={cn(
 "flex-1 pb-3 text-sm font-bold transition-colors uppercase tracking-wider relative",
 !requiresOtp ? "text-primary border-b-4 border-primary" : "text-slate-500 hover:text-slate-700"
 )}
 onClick={requiresOtp ? (isMfaStep ? handleResetMfa : handleBackToLogin) : undefined}
 >
 Credentials
 </button>
 <button
 type="button"
 className={cn(
 "flex-1 pb-3 text-sm font-bold transition-colors uppercase tracking-wider relative",
 requiresOtp ? "text-primary border-b-4 border-primary" : "text-slate-300 cursor-not-allowed"
 )}
 >
 Verification (OTP)
 </button>
 </div>

 <form className="space-y-6" onSubmit={handleSubmit}>
 {!requiresOtp ? (
 <>
 <div className="space-y-2">
 <Label htmlFor="phone" className="text-slate-900 font-bold">Phone Number</Label>
 <Input
 id="phone"
 placeholder="+256 7XX XXX XXX"
 value={phone}
 onChange={(event) => {
 setPhone(event.target.value);
 setPageError(null);
 }}
 autoComplete="tel"
 className="h-12 border-2 border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0"
 required
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="password" className="text-slate-900 font-bold">Password</Label>
 <a href="#" className="text-sm font-semibold text-primary hover:underline">Forgot password?</a>
 </div>
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
 className="h-12 border-2 border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0 pr-10"
 required
 />
 <button
 type="button"
 aria-label={showPassword ? "Hide password" : "Show password"}
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
 <div className="rounded-sm bg-slate-50 border border-slate-200 p-4 mb-4 flex items-start gap-3">
 <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
 <p className="text-sm text-slate-700">
 For your security, we need to verify your identity. Enter the 6-digit code sent to <span className="font-bold">{phone.trim()}</span>.
 </p>
 </div>
 <div className="flex justify-center py-4">
 <OtpCodeInput id="otp" value={otp} onChange={setOtp} disabled={isLoading} />
 </div>
 </div>
 )}

 {(pageError || authError) && (
 <div className="rounded-sm bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
 {pageError || authError}
 </div>
 )}

 <Button 
 className="h-12 w-full text-base font-bold bg-primary hover:bg-primary/90 text-white rounded-sm shadow-none" 
 type="submit" 
 disabled={isLoading || !canSubmit}
 >
 {requiresOtp ? "Verify Securely" : "Sign In Securely"}
 </Button>
 </form>
 </div>
 
 <div className="mt-8 text-center text-sm text-slate-600">
 <p>
 Need an account?{" "}
 <button type="button" onClick={() => navigate("/register")} className="font-bold text-primary hover:underline">
 Register as a Vendor
 </button>
 </p>
 <div className="mt-8 pt-4 border-t border-slate-300/50 flex items-center justify-center gap-4 text-xs">
 <a href="#" className="hover:underline">Terms of Service</a>
 <span>•</span>
 <a href="#" className="hover:underline">Privacy Policy</a>
 <span>•</span>
 <a href="#" className="hover:underline">Security</a>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

export default LoginPage;
