/**
 * One-shot script to register (or re-register) the Pesapal IPN callback URL
 * with the Pesapal API. Run whenever the IPN endpoint changes.
 */
import { registerPesapalIpn } from "../server/lib/pesapal.ts";

const result = await registerPesapalIpn();
console.log(JSON.stringify(result, null, 2));
