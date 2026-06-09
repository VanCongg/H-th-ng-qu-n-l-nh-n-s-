import { ShellLayout } from "./ShellLayout";
import { adminNavItems } from "./nav";

export function AdminLayout() {
  return <ShellLayout mode="admin" navItems={adminNavItems} />;
}
