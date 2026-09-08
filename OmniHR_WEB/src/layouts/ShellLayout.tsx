import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Divider,
  Group,
  Menu,
  Modal,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  ChevronDown,
  Languages,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  UserRound
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/endpoints";
import { getApiErrorMessage } from "../api/axios";
import { BrandLogo } from "../components/BrandLogo";
import { NotificationBell } from "../components/NotificationBell";
import { useTranslation } from "../i18n";
import { useAuthStore } from "../store/auth";
import { useNotificationsStore } from "../store/notifications";
import type { RoleName } from "../api/types";
import { usePreferencesStore, type AppLanguage } from "../store/preferences";
import type { NavItem } from "./nav";

type ShellLayoutProps = {
  mode: "app" | "admin";
  navItems: NavItem[];
  children?: ReactNode;
};

export function ShellLayout({ mode, navItems }: ShellLayoutProps) {
  const [opened, { toggle, close: closeNavbar }] = useDisclosure();
  const [desktopNavbarCollapsed, setDesktopNavbarCollapsed] = useState(false);
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logoutLocal = useAuthStore((state) => state.logoutLocal);
  const connectNotifications = useNotificationsStore((state) => state.connect);
  const disconnectNotifications = useNotificationsStore((state) => state.disconnect);
  const language = usePreferencesStore((state) => state.language);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { t, tx } = useTranslation();
  const selectedScheme = colorScheme === "dark" ? "dark" : "light";

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch (error) {
      notifications.show({
        color: "orange",
        message: getApiErrorMessage(error)
      });
    } finally {
      logoutLocal();
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    if (accessToken) {
      connectNotifications(accessToken);
    } else {
      disconnectNotifications();
    }
    return () => disconnectNotifications();
  }, [accessToken, connectNotifications, disconnectNotifications]);

  const initials =
    user?.username
      ?.split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: "md",
        collapsed: { mobile: !opened, desktop: desktopNavbarCollapsed }
      }}
      header={{ height: 76 }}
      padding="md"
      className="app-shell"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />
            <Tooltip
              label={tx(desktopNavbarCollapsed ? "Show sidebar" : "Hide sidebar")}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                visibleFrom="md"
                onClick={() => setDesktopNavbarCollapsed((value) => !value)}
                aria-label={tx(
                  desktopNavbarCollapsed ? "Show sidebar" : "Hide sidebar"
                )}
              >
                {desktopNavbarCollapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
              </ActionIcon>
            </Tooltip>
            <UnstyledButton className="brand-mark" onClick={() => navigate("/")}>
              <BrandLogo className="brand-logo--shell" />
              <Stack gap={2} className="brand-copy">
                <Text fw={900} lh={1} className="brand-name">
                  OmniHR
                </Text>
                <Text size="xs" c="dimmed" lh={1.15} className="brand-subtitle">
                  {mode === "admin" ? t("adminWorkspace") : t("managerWorkspace")}
                </Text>
              </Stack>
            </UnstyledButton>
          </Group>

          <Group gap="xs" wrap="nowrap" className="header-actions">
            <NotificationBell />
            <Menu width={320} position="bottom-end" radius="md" shadow="lg">
              <Menu.Target>
                <UnstyledButton className="avatar-trigger">
                  <Avatar radius="md" color="blue" size={38} className="avatar-badge">
                    {initials}
                  </Avatar>
                  <Stack gap={0} className="header-user" visibleFrom="xs">
                    <Text size="sm" fw={750} truncate>
                      {user?.username}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {formatRoles(user?.roles, t("noRole"))}
                    </Text>
                  </Stack>
                  <ChevronDown size={16} />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap="sm" p="sm">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar radius="md" color="blue" size={46}>
                      {initials}
                    </Avatar>
                    <Stack gap={1} className="profile-summary">
                      <Text fw={800} truncate>
                        {user?.username}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {user?.email}
                      </Text>
                    </Stack>
                  </Group>
                  <Group gap={6}>
                    {user?.roles.map((role) => (
                      <span key={role} className={`role-chip role-${role.toLowerCase()}`}>
                        {role}
                      </span>
                    ))}
                  </Group>
                </Stack>
                <Divider />
                <Menu.Label>{t("account")}</Menu.Label>
                {mode === "app" ? (
                  <Menu.Item
                    leftSection={<UserRound size={16} />}
                    onClick={() => navigate("/app/profile")}
                  >
                    {t("personalInformation")}
                  </Menu.Item>
                ) : null}
                <Menu.Item
                  leftSection={<Settings size={16} />}
                  onClick={openSettings}
                >
                  {t("settings")}
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<LogOut size={16} />}
                  onClick={handleLogout}
                >
                  {t("logout")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="md" h="100%">
          <ScrollArea className="nav-scroll">
            <Stack gap={4}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  label={t(item.labelKey)}
                  leftSection={<item.icon size={18} />}
                  active={location.pathname === item.to}
                  className="side-nav-link"
                  onClick={closeNavbar}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <Modal opened={settingsOpened} onClose={closeSettings} title={t("settings")}>
        <Stack gap="md">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" radius="md" size={38}>
              <Languages size={20} />
            </ThemeIcon>
            <Stack gap={6} className="settings-control">
              <Text fw={750}>{t("language")}</Text>
              <Select
                data={[
                  { value: "en", label: t("english") },
                  { value: "vi", label: t("vietnamese") }
                ]}
                value={language}
                onChange={(value) =>
                  value ? setLanguage(value as AppLanguage) : undefined
                }
                allowDeselect={false}
              />
            </Stack>
          </Group>

          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="violet" variant="light" radius="md" size={38}>
              {colorScheme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
            </ThemeIcon>
            <Stack gap={6} className="settings-control">
              <Text fw={750}>{t("appearance")}</Text>
              <SegmentedControl
                data={[
                  { label: t("light"), value: "light" },
                  { label: t("dark"), value: "dark" }
                ]}
                value={selectedScheme}
                onChange={(value) => setColorScheme(value as "light" | "dark")}
              />
            </Stack>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}

function formatRoles(roles: RoleName[] | undefined, fallback: string) {
  return roles?.join(" / ") || fallback;
}
