import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

const isChunkLoadError = (error: Error) =>
  /loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
    error.message,
  );

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Route Error Boundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const chunkError = this.state.error ? isChunkLoadError(this.state.error) : false;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {chunkError
                ? "A new version of the app may have been deployed. Please reload the page to continue."
                : "This page couldn't load. Please reload the page or try again later."}
            </AlertDescription>
            <Button variant="outline" size="sm" className="mt-3" onClick={this.handleReload}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload page
            </Button>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
