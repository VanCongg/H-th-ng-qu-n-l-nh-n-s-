// Khung trang khu /app (quản lý): ShellLayout với menu quản lý.

import { ShellLayout } from "./ShellLayout";
import { appNavItems } from "./nav";

export function AppLayout() {
  return <ShellLayout mode="app" navItems={appNavItems} />;
}
