/**
 * Admin layout wrapper rendering nested child routes.
 * Admin role only.
 */
import { Outlet } from "react-router-dom";

const AdminLayout = () => <Outlet />;

export default AdminLayout;
