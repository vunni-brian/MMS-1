import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DashboardErrorBoundaryProps {
 children: ReactNode;
 fallback?: ReactNode;
}

interface DashboardErrorBoundaryState {
 hasError: boolean;
 error?: Error;
}

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

export const DashboardErrorBoundary = ({ children, fallback }: DashboardErrorBoundaryProps) => {
 const { t } = useTranslation();
 return <DashboardErrorBoundaryInner t={t} fallback={fallback}>{children}</DashboardErrorBoundaryInner>;
};
