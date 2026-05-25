import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-lg bg-muted">
          <Store className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold font-heading text-foreground">Market Management System</h1>
        <p className="text-muted-foreground text-lg">
          Streamline your market operations — manage stalls, payments, and vendors all in one place.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => navigate('/login')} className="gap-2">
            Sign In <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/register')}>
            Register as Vendor
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Staff accounts are created by administrators. Contact your market manager if you need access.
        </p>
      </div>
    </div>
  );
};

export default Index;
