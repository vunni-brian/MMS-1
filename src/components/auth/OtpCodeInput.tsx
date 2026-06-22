/**
 * OtpCodeInput - 6-digit OTP input used during authentication flows. Strips
 * non-digit characters from the input value.
 */
import { cn } from "@/lib/utils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/** Props for the OtpCodeInput component. */
interface OtpCodeInputProps {
 id?: string;
 value: string;
 onChange: (value: string) => void;
 disabled?: boolean;
 className?: string;
}

/** Index positions for the six OTP input slots. */
const otpSlots = [0, 1, 2, 3, 4, 5];

/**
 * OtpCodeInput - Renders a 6-slot OTP input with auto-focus and digit-only filtering.
 */
export const OtpCodeInput = ({ id, value, onChange, disabled = false, className }: OtpCodeInputProps) => {
 return (
 <div className={cn("flex justify-center sm:justify-start", className)}>
 <InputOTP
 id={id}
 maxLength={6}
 value={value}
  // Strip any non-digit characters from the input (e.g. spaces, letters).
  onChange={(nextValue) => onChange(nextValue.replace(/\D/g, ""))}
 disabled={disabled}
 autoFocus
 containerClassName="justify-center sm:justify-start"
 >
 <InputOTPGroup>
 {otpSlots.map((index) => (
 <InputOTPSlot key={index} index={index} className="h-12 w-12 text-base" />
 ))}
 </InputOTPGroup>
 </InputOTP>
 </div>
 );
};
