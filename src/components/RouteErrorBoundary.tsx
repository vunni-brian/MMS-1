/**
 * RouteErrorBoundary - Error boundary for route-level failures. Catches rendering
 * errors and handles chunk-load failures by auto-reloading the page once.
 */
import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Props for the RouteErrorBoundary component. */
interface RouteErrorBoundaryProps {
  children: ReactNode;
}

/** State for the RouteErrorBoundary component. */
interface RouteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/** Checks whether an error is a dynamic-import / chunk-load failure. */
const isChunkLoadError = (error: Error) =>
  /loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
    error.message,
  );

/**
 * Inner class component that implements the error boundary lifecycle for routes.
 */
class RouteErrorBoundaryInner extends Component<RouteErrorBoundaryProps & { t: (key: string) => string }, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps & { t: (key: string) => string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Route Error Boundary caught an error:", error, errorInfo);
    // Auto-reload once on chunk-load failures (e.g. after a deploy),
    // using sessionStorage to prevent infinite reload loops.
    if (isChunkLoadError(error)) {
      const reloadKey = "chunk_reload_attempted";
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const chunkError = this.state.error ? isChunkLoadError(this.state.error) : false;
      const { t } = this.props;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("error:route.title")}</AlertTitle>
            <AlertDescription>
              {chunkError
                ? t("error:route.versionDesc")
                : t("error:route.reloadDesc")}
            </AlertDescription>
            <Button variant="outline" size="sm" className="mt-3" onClick={this.handleReload}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("error:route.reload")}
            </Button>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * RouteErrorBoundary - Wraps children in an error boundary that catches route-level
 * crashes and shows a reload prompt. Automatically reloads once on chunk-load errors.
 */
export const RouteErrorBoundary = ({ children }: RouteErrorBoundaryProps) => {
  const { t } = useTranslation();
  return <RouteErrorBoundaryInner t={t}>{children}</RouteErrorBoundaryInner>;
};
