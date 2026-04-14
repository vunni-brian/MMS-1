import { config } from "../config.ts";

type PesapalError = {
  code?: string;
  message?: string;
  error_type?: string;
};

type PesapalTokenResponse = {
  token?: string;
  expiryDate?: string;
  status?: string;
  message?: string;
  error?: PesapalError | null;
};

type PesapalRegisterIpnResponse = {
  ipn_id?: string;
  url?: string;
  created_date?: string;
  status?: string;
  message?: string;
  error?: PesapalError | null;
};

export type PesapalSubmitOrderResponse = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
  status?: string;
  message?: string;
  error?: PesapalError | null;
};

export type PesapalTransactionStatusResponse = {
  payment_method?: string;
  amount?: number;
  created_date?: string;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  message?: string;
  payment_account?: string;
  call_back_url?: string;
  status_code?: number;
  merchant_reference?: string;
  currency?: string;
  error?: PesapalError | null;
  status?: string;
};

let cachedToken: {
  token: string;
  expiresAt: number;
} | null = null;

const parsePesapalResponse = async (response: Response) => {
  const text = await response.text();
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new Error("Pesapal returned a non-JSON response.");
        }
      })()
    : {};

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Pesapal request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

const pesapalFetch = async <T>(path: string, init: RequestInit = {}, token?: string): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${config.pesapalBaseUrl}${path}`, {
    ...init,
    headers,
  });

  return (await parsePesapalResponse(response)) as T;
};

export const getPesapalRedirectMode = (useIframe: boolean) => (useIframe ? "PARENT_WINDOW" : "TOP_WINDOW");

export const getPesapalPaymentOutcome = (
  paymentStatusDescription?: string | null,
): "completed" | "failed" | "pending" => {
  const normalized = String(paymentStatusDescription || "").trim().toUpperCase();

  if (normalized === "COMPLETED") {
    return "completed";
  }

  if (["FAILED", "INVALID", "REVERSED"].includes(normalized)) {
    return "failed";
  }

  return "pending";
};

export const getPesapalToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  if (!config.pesapalConsumerKey || !config.pesapalConsumerSecret) {
    throw new Error("Pesapal is not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.");
  }

  const data = await pesapalFetch<PesapalTokenResponse>("/api/Auth/RequestToken", {
    method: "POST",
    body: JSON.stringify({
      consumer_key: config.pesapalConsumerKey,
      consumer_secret: config.pesapalConsumerSecret,
    }),
  });

  if (!data.token) {
    throw new Error(data.message || data.error?.message || "Pesapal token was not returned.");
  }

  const expiresAt = data.expiryDate ? new Date(data.expiryDate).getTime() - 30_000 : Date.now() + 4 * 60_000;
  cachedToken = {
    token: data.token,
    expiresAt,
  };

  return data.token;
};

export const registerPesapalIpn = async () => {
  if (!config.pesapalIpnUrl) {
    throw new Error("Pesapal IPN URL is not configured. Set PESAPAL_IPN_URL.");
  }

  const token = await getPesapalToken();
  return await pesapalFetch<PesapalRegisterIpnResponse>(
    "/api/URLSetup/RegisterIPN",
    {
      method: "POST",
      body: JSON.stringify({
        url: config.pesapalIpnUrl,
        ipn_notification_type: "POST",
      }),
    },
    token,
  );
};

export const submitPesapalOrder = async (input: {
  id: string;
  amount: number;
  description: string;
  callbackUrl: string;
  notificationId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  accountNumber?: string;
}) => {
  if (!input.callbackUrl) {
    throw new Error("Pesapal callback URL is not configured. Set PESAPAL_CALLBACK_URL.");
  }
  if (!input.notificationId) {
    throw new Error("Pesapal IPN ID is not configured. Set PESAPAL_IPN_ID.");
  }

  const token = await getPesapalToken();
  return await pesapalFetch<PesapalSubmitOrderResponse>(
    "/api/Transactions/SubmitOrderRequest",
    {
      method: "POST",
      body: JSON.stringify({
        id: input.id,
        currency: "UGX",
        amount: input.amount,
        description: input.description.slice(0, 100),
        callback_url: input.callbackUrl,
        notification_id: input.notificationId,
        redirect_mode: getPesapalRedirectMode(config.pesapalUseIframe),
        billing_address: {
          email_address: input.email || "",
          phone_number: input.phone || "",
          country_code: "UG",
          first_name: input.firstName || "",
          middle_name: "",
          last_name: input.lastName || "",
          line_1: "",
          line_2: "",
          city: "",
          state: "",
          postal_code: "",
          zip_code: "",
        },
        account_number: input.accountNumber || "",
      }),
    },
    token,
  );
};

export const getPesapalTransactionStatus = async (orderTrackingId: string) => {
  if (!orderTrackingId) {
    throw new Error("Pesapal order tracking id is required.");
  }

  const token = await getPesapalToken();
  return await pesapalFetch<PesapalTransactionStatusResponse>(
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { method: "GET" },
    token,
  );
};
