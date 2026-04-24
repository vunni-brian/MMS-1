interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (statusCode: number) => VercelResponse;
  send: (body: string) => void;
  json: (body: unknown) => void;
}

const pesapalIpnTarget =
  process.env.PESAPAL_IPN_PROXY_TARGET || "https://mms-api.onrender.com/payments/webhooks/pesapal";

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
