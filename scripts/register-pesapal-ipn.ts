import { registerPesapalIpn } from "../server/lib/pesapal.ts";

const result = await registerPesapalIpn();
console.log(JSON.stringify(result, null, 2));
