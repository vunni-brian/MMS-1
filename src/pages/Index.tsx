import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10">
          <Store className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-heading text-foreground">Market Management System</h1>
        <p className="text-muted-foreground text-lg">
          Streamline your market operations — manage stalls, payments, and vendors all in one place.
        </p>
        <Button size="lg" onClick={() => navigate('/login')} className="gap-2">
          Get Started <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
