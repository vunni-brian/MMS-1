import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface OtpCodeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const otpSlots = [0, 1, 2, 3, 4, 5];

export const OtpCodeInput = ({ id, value, onChange, disabled = false }: OtpCodeInputProps) => {
  return (
    <div className="flex justify-center sm:justify-start">
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        onChange={(nextValue) => onChange(nextValue.replace(/\D/g, ""))}
        disabled={disabled}
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
