import {
  Anchor,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { Building2, LogIn, ShieldCheck, Users } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { authApi } from "../../api/endpoints";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { tx } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const user = useAuthStore((state) => state.user);

  const form = useForm({
    initialValues: {
      usernameOrEmail: "superadmin",
      password: "Admin@123456"
    },
    validate: {
      usernameOrEmail: (value) => (value.trim() ? null : tx("Required")),
      password: (value) => (value.length >= 6 ? null : tx("Minimum 6 characters"))
    }
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      authApi.login(values.usernameOrEmail, values.password),
    onSuccess: (session) => {
      setSession(session);
      const from = (location.state as LoginLocationState | null)?.from?.pathname;
      if (session.user.roles.includes("EMPLOYEE")) {
        navigate("/employee-web-notice", { replace: true });
        return;
      }
      navigate(from || "/app/dashboard", { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        message: getApiErrorMessage(error)
      });
    }
  });

  useEffect(() => {
    if (user?.roles.includes("ADMIN") || user?.roles.includes("MANAGER")) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [navigate, user]);

  return (
    <Center mih="100vh" p="md" className="login-screen">
      <Paper withBorder radius="md" className="login-panel">
        <div className="login-visual">
          <Stack gap="xl">
            <Group gap="sm">
              <ThemeIcon size={44} radius="md" color="blue" variant="filled">
                <Building2 size={24} />
              </ThemeIcon>
              <Stack gap={2}>
                <Title order={1}>OmniHR</Title>
                <Text c="dimmed">{tx("Core HR workspace")}</Text>
              </Stack>
            </Group>
            <Stack gap="sm" className="login-points">
              <Group gap="sm">
                <ShieldCheck size={18} />
                <Text size="sm">{tx("RBAC, permissions, and manager scope")}</Text>
              </Group>
              <Group gap="sm">
                <Users size={18} />
                <Text size="sm">{tx("Employees, teams, attendance, and leave")}</Text>
              </Group>
            </Stack>
          </Stack>
        </div>

        <form
          className="login-form"
          onSubmit={form.onSubmit((values) => mutation.mutate(values))}
        >
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={2}>{tx("Login")}</Title>
              <Text c="dimmed" size="sm">
                {tx("Use your system account to continue.")}
              </Text>
            </Stack>
            <TextInput
              label={tx("Username or email")}
              placeholder="superadmin"
              {...form.getInputProps("usernameOrEmail")}
            />
            <PasswordInput
              label={tx("Password")}
              placeholder={tx("Password")}
              {...form.getInputProps("password")}
            />
            <Button
              type="submit"
              leftSection={<LogIn size={17} />}
              loading={mutation.isPending}
              fullWidth
            >
              {tx("Login")}
            </Button>
            <Text size="xs" c="dimmed">
              API:{" "}
              <Anchor href={import.meta.env.VITE_API_BASE_URL} target="_blank">
                {import.meta.env.VITE_API_BASE_URL}
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
