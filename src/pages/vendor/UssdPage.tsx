import { useState } from "react";
import { Hash, MessageSquare, Phone } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const UssdPage = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState("STATUS");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commands = [
    { code: '*384*100#', desc: 'Check stall availability', provider: 'All networks' },
    { code: '*384*200#', desc: 'Check last payment status', provider: 'All networks' },
    { code: 'SMS "STATUS" to 8100', desc: 'Get stall and payment status via SMS', provider: 'MTN / Airtel' },
    { code: 'SMS "AVAIL" to 8100', desc: 'Get available stalls list via SMS', provider: 'MTN / Airtel' },
  ];

  const runSimulation = async () => {
    if (!user?.phone) {
      return;
    }
    setError(null);
    try {
      const result = await api.simulateSms(user.phone, message);
      setResponse(result.response);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "Unable to simulate fallback query.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">USSD / SMS Access</h1>
        <p className="text-muted-foreground text-sm mt-1">Access market info without a smartphone</p>
      </div>

      <Card className="card-warm">
        <CardContent className="p-4 flex items-start gap-3">
          <Phone className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">No smartphone? No problem!</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can check your stall status and payment confirmations using USSD codes or SMS from any basic phone.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {commands.map((cmd, i) => (
          <Card key={i} className="card-warm">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                {cmd.code.startsWith('*') ? <Hash className="w-5 h-5 text-muted-foreground" /> : <MessageSquare className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="font-mono font-bold text-sm">{cmd.code}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{cmd.desc}</p>
                <p className="text-xs text-muted-foreground mt-1">{cmd.provider}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-2"><CardTitle className="text-base font-heading">How It Works</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Dial the USSD code or send an SMS keyword from your registered phone number.</p>
          <p>2. The system will verify your phone number and return your stall or payment information.</p>
          <p>3. All queries are logged for security and audit purposes.</p>
          <p className="text-xs mt-3 p-2 bg-muted/50 rounded-lg">
            Note: You must use the phone number registered with your vendor account.
          </p>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Simulate SMS Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder='Try "STATUS" or "AVAIL"' />
          <Button onClick={runSimulation}>Run Query</Button>
          {response && <div className="rounded-lg bg-muted/50 p-3 text-sm">{response}</div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default UssdPage;
