export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://mms-api-xpmb.onrender.com/payments/webhooks/pesapal",
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