/**
 * DashboardErrorBoundary - React error boundary for dashboard widgets. Catches
 * rendering errors inside its children and shows a dismissable alert with a retry
 * button. Accepts an optional custom fallback.
 */
import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Props for the DashboardErrorBoundary component.
 */
interface DashboardErrorBoundaryProps {
 children: ReactNode;
 /** Optional custom fallback element shown instead of the default alert. */
 fallback?: ReactNode;
}

interface DashboardErrorBoundaryState {
 hasError: boolean;
 error?: Error;
}

/**
 * Inner class component that implements the error boundary lifecycle.
 */
class DashboardErrorBoundaryInner extends Component<
 DashboardErrorBoundaryProps & { t: (key: string) => string },
 DashboardErrorBoundaryState
> {
 constructor(props: DashboardErrorBoundaryProps & { t: (key: string) => string }) {
 super(props);
 this.state = { hasError: false };
 }

 static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
 return { hasError: true, error };
 }

 componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
 console.error("Dashboard Error Boundary caught an error:", error, errorInfo);
 }

 handleReset = () => {
 this.setState({ hasError: false, error: undefined });
 };

 render() {
 if (this.state.hasError) {
 if (this.props.fallback) {
 return this.props.fallback;
 }

 const isDev = import.meta.env.DEV;
 const { t } = this.props;

 return (
 <Alert variant="destructive" className="my-4">
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>{t("error:dashboard.title")}</AlertTitle>
 <AlertDescription>
 {isDev && this.state.error?.message
 ? this.state.error.message
 : t("error:dashboard.description")}
 </AlertDescription>
 <Button
 variant="outline"
 size="sm"
 className="mt-3"
 onClick={this.handleReset}
 >
 <RefreshCw className="h-4 w-4 mr-2" />
 {t("common:retry")}
 </Button>
 </Alert>
 );
 }

 return this.props.children;
 }
}

/**
 * DashboardErrorBoundary - Wraps children in an error boundary that catches
 * dashboard widget crashes and shows a user-friendly retry prompt.
 */
export const DashboardErrorBoundary = ({ children, fallback }: DashboardErrorBoundaryProps) => {
 const { t } = useTranslation();
 return <DashboardErrorBoundaryInner t={t} fallback={fallback}>{children}</DashboardErrorBoundaryInner>;
};
