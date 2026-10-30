import {AuthGuard} from '@/components/auth-guard';
import {AdminAuthorizationGuard} from '@/components/admin-authorization-guard';
import {DashboardShell} from '@/components/dashboard-shell';

export default function Layout({children}:{children:React.ReactNode}) {
  return <AuthGuard><AdminAuthorizationGuard><DashboardShell>{children}</DashboardShell></AdminAuthorizationGuard></AuthGuard>;
}
