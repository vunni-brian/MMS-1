/**
 * Vercel serverless function that proxies Pesapal IPN (Instant Payment Notification)
 * callbacks to the backend API, avoiding CORS and network visibility issues.
 */
interface VercelRequest {
  /** HTTP method of the incoming request. */
  method?: string;
  /** Raw request body containing the IPN payload. */
  body?: unknown;
}

interface VercelResponse {
  /** Sets the HTTP response status code and returns the response object for chaining. */
  status: (statusCode: number) => VercelResponse;
  /** Sends a plain-text response body. */
  send: (body: string) => void;
  /** Sends a JSON response body. */
  json: (body: unknown) => void;
}

/** Upstream backend URL that receives the forwarded IPN payload. */
const pesapalIpnTarget =
  process.env.PESAPAL_IPN_PROXY_TARGET || "https://mms-api.onrender.com/payments/webhooks/pesapal";

/**
 * Proxies an incoming IPN request to the configured backend endpoint.
 * Forwards the original method and body, then relays the backend response back.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(
      pesapalIpnTarget,
      {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.text();

    res.status(response.status).send(data);
  } catch (error) {
    console.error("IPN proxy error:", error);
    res.status(500).json({ error: "Proxy failed" });
  }
}
