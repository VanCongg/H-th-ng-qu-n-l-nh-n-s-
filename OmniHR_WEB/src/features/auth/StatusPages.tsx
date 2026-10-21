import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, LogOut, ShieldAlert, Smartphone } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { authApi } from "../../api/endpoints";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

export function ForbiddenPage() {
  const { tx } = useTranslation();
  const navigate = useNavigate();

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" radius="md" className="status-panel">
        <Stack align="center" gap="sm">
          <ThemeIcon size={52} radius="md" variant="light" color="red">
            <ShieldAlert size={28} />
          </ThemeIcon>
          <Title order={2}>403</Title>
          <Text c="dimmed" ta="center">
            {tx("You do not have access to this area.")}
          </Text>
          <Button leftSection={<ArrowLeft size={16} />} onClick={() => navigate("/")}>
            {tx("Back")}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

export function MobileNoticePage() {
  const { t, tx } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logoutLocal = useAuthStore((state) => state.logoutLocal);

  // Employees have no web area to go back to, so the only way out of this
  // screen is ending the session - sending them to /login while still signed
  // in would bounce them straight back here.
  async function handleSignOut() {
    try {
      await authApi.logout();
    } catch (error) {
      notifications.show({ color: "orange", message: getApiErrorMessage(error) });
    } finally {
      logoutLocal();
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    if (user?.roles.includes("ADMIN")) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    if (user?.roles.includes("MANAGER")) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [navigate, user]);

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder p="xl" radius="md" className="status-panel">
        <Stack align="center" gap="sm">
          <ThemeIcon size={52} radius="md" variant="light" color="teal">
            <Smartphone size={28} />
          </ThemeIcon>
          <Title order={2}>{tx("Mobile App")}</Title>
          <Text c="dimmed" ta="center">
            {tx("Employee accounts should use the mobile app for daily actions.")}
          </Text>
          <Button leftSection={<LogOut size={16} />} onClick={handleSignOut}>
            {t("logout")}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
