import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Landmark, Smartphone } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/console/ConsolePage";
import { MockupHeader, MockupPage, MockupPanel, StatusPill } from "@/components/mockup/MockupUI";
import { toast } from "@/components/ui/sonner";

type PaymentMethod = "mobile" | "card" | "bank";

interface PayableItem {
  stall: string;
  paymentType: string;
  period: string;
  amount: number;
  payload: {
    bookingId?: string | null;
    utilityChargeId?: string | null;
    penaltyId?: string | null;
  };
}

const fallbackPayable: PayableItem = {
  stall: "A-12",
  paymentType: "Stall Rent",
  period: "May 2025",
  amount: 100_000,
  payload: {},
};

const methodOptions: Array<{ id: PaymentMethod; label: string; icon: typeof Smartphone; detail: string }> = [
  { id: "mobile", label: "Mobile Money", icon: Smartphone, detail: "MTN and Airtel" },
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, detail: "Visa or Mastercard" },
  { id: "bank", label: "Bank Transfer", icon: Landmark, detail: "Manual bank transfer" },
];

const currentPeriod = () => {
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);
};

const PaymentsPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mobile");

  const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const utilityChargesQuery = useQuery({
    queryKey: ["utility-charges", "payment-page"],
    queryFn: () => api.getUtilityCharges(),
    enabled: role === "vendor",
  });
  const penaltiesQuery = useQuery({
    queryKey: ["penalties", "payment-page"],
    queryFn: () => api.getPenalties(),
    enabled: role === "vendor",
  });

  const isLoading =
    bookingsQuery.isPending ||
    (role === "vendor" && (utilityChargesQuery.isPending || penaltiesQuery.isPending));

  const isError =
    bookingsQuery.isError ||
    (role === "vendor" && (utilityChargesQuery.isError || penaltiesQuery.isError));

  const payable = useMemo<PayableItem>(() => {
    const bookings = bookingsQuery.data?.bookings || [];
    const approvedBooking = bookings.find((booking) => booking.status === "approved" && booking.amount > 0);
    if (approvedBooking) {
      return {
        stall: approvedBooking.stallName,
        paymentType: "Stall Rent",
        period: currentPeriod(),
        amount: approvedBooking.amount,
        payload: { bookingId: approvedBooking.id },
      };
    }

    const utility = (utilityChargesQuery.data?.utilityCharges || []).find((charge) =>
      ["unpaid", "overdue"].includes(charge.status) && charge.amount > 0,
    );
    if (utility) {
      return {
        stall: utility.stallName || "Assigned Stall",
        paymentType: utility.description || "Utility Fee",
        period: utility.billingPeriod,
        amount: utility.amount,
        payload: { utilityChargeId: utility.id },
      };
    }

    const penalty = (penaltiesQuery.data?.penalties || []).find((item) => item.status === "unpaid" && item.amount > 0);
    if (penalty) {
      return {
        stall: "Assigned Stall",
        paymentType: "Penalty",
        period: currentPeriod(),
        amount: penalty.amount,
        payload: { penaltyId: penalty.id },
      };
    }

    return fallbackPayable;
  }, [bookingsQuery.data?.bookings, penaltiesQuery.data?.penalties, utilityChargesQuery.data?.utilityCharges]);

  const hasRealPayable = Boolean(payable.payload.bookingId || payable.payload.utilityChargeId || payable.payload.penaltyId);

  const initiatePayment = useMutation({
    mutationFn: () => api.initiateGatewayPayment(payable.payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment started", { description: response.message || "Continue with the payment provider." });
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
      }
    },
    onError: (error) => {
      toast.error("Payment could not start", {
        description: error instanceof ApiError ? error.message : "Unable to initiate this payment.",
      });
    },
  });

  if (isError) {
    return (
      <MockupPage>
        <Alert variant="destructive" className="max-w-xl">
          <AlertTitle>Error loading payments</AlertTitle>
          <AlertDescription>We could not reach the server to load payment details.</AlertDescription>
        </Alert>
      </MockupPage>
    );
  }

  if (isLoading) {
    return (
      <MockupPage>
        <LoadingState rows={4} itemClassName="h-28 rounded-lg" />
      </MockupPage>
    );
  }

  return (
    <MockupPage>
      <MockupHeader
        eyebrow="Payments > Make Payment"
        title="Make Payment"
        subtitle="Select a payment method and review the total before checkout."
      />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <MockupPanel title="Payment Details">
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500">Stall</p>
              <p className="mt-1 font-bold text-slate-900">{payable.stall}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Payment Type</p>
              <p className="mt-1 font-bold text-slate-900">{payable.paymentType}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Period</p>
              <p className="mt-1 font-bold text-slate-900">{payable.period}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Amount</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</p>
            </div>
          </div>
        </MockupPanel>

        <MockupPanel title="Select Payment Method">
          <div className="space-y-3">
            {methodOptions.map((method) => {
              const Icon = method.icon;
              const selected = selectedMethod === method.id;

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors ${
                    selected ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                      {selected ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : null}
                    </span>
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{method.label}</span>
                      <span className="text-xs text-slate-500">{method.detail}</span>
                    </span>
                  </span>
                  {method.id === "mobile" ? (
                    <span className="flex shrink-0 gap-1">
                      <StatusPill tone="slate">MTN</StatusPill>
                      <StatusPill tone="red">airtel</StatusPill>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <Button
            className="mt-5 h-11 w-full"
            disabled={initiatePayment.isPending}
            onClick={() => {
              if (!hasRealPayable) {
                toast.info("No live payable item is currently available.");
                return;
              }
              initiatePayment.mutate();
            }}
          >
            {initiatePayment.isPending ? "Starting Payment..." : "Proceed to Pay"}
          </Button>
        </MockupPanel>

        <MockupPanel title="Payment Summary">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Amount</span>
              <span className="font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Charges</span>
              <span className="font-bold text-slate-900">{formatCurrency(0)}</span>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">Total Amount</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(payable.amount)}</span>
              </div>
            </div>
            <div className="pt-8 text-center">
              <p className="text-[11px] text-slate-400">Secure payments powered by</p>
              <p className="mt-1 text-2xl font-bold tracking-normal text-blue-600">
                pesa<span className="text-red-500">pal</span>
              </p>
            </div>
          </div>
        </MockupPanel>
      </div>
    </MockupPage>
  );
};

export default PaymentsPage;
