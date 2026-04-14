import crypto from "node:crypto";

const FLUTTERWAVE_API_BASE_URL = "https://api.flutterwave.com/v3";

const parseFlutterwaveResponse = async (response: Response) => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `${response.status} ${response.statusText}`;
    throw new Error(`Flutterwave request failed: ${message}`);
  }

  return payload;
};

export const initiateFlutterwaveUgandaCharge = async ({
  secretKey,
  txRef,
  amount,
  email,
  phoneNumber,
  network,
  fullname,
}: {
  secretKey: string;
  txRef: string;
  amount: number;
  email: string;
  phoneNumber: string;
  network: "mtn" | "airtel";
  fullname?: string;
}) => {
  if (!secretKey) {
    throw new Error("Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY.");
  }

  const response = await fetch(`${FLUTTERWAVE_API_BASE_URL}/charges?type=mobile_money_uganda`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: "UGX",
      email,
      phone_number: phoneNumber,
      network: network.toUpperCase(),
      fullname: fullname || undefined,
    }),
  });

  return await parseFlutterwaveResponse(response) as {
    status?: string;
    message?: string;
    data?: {
      id?: number | string;
      status?: string;
      reference?: string;
      tx_ref?: string;
      processor_response?: unknown;
    };
  };
};

export const verifyFlutterwaveTransaction = async ({
  secretKey,
  transactionId,
}: {
  secretKey: string;
  transactionId: string | number;
}) => {
  if (!secretKey) {
    throw new Error("Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY.");
  }

  const response = await fetch(`${FLUTTERWAVE_API_BASE_URL}/transactions/${transactionId}/verify`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  return await parseFlutterwaveResponse(response) as {
    status?: string;
    message?: string;
    data?: {
      id?: number | string;
      tx_ref?: string;
      amount?: number;
      currency?: string;
      status?: string;
      reference?: string;
    };
  };
};

export const isValidFlutterwaveWebhook = ({
  rawBody,
  signature,
  secretHash,
}: {
  rawBody: string;
  signature: string | undefined;
  secretHash: string;
}) => {
  if (!signature || !secretHash) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secretHash).update(rawBody).digest("base64");
  return expectedSignature === signature;
};
