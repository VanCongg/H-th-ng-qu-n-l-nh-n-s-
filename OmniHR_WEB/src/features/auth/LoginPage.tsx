import {
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { LogIn, ShieldCheck, Users } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { authApi } from "../../api/endpoints";
import { BrandLogo } from "../../components/BrandLogo";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";
import type { RoleName } from "../../api/types";

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
      authApi.login(values.usernameOrEmail.trim(), values.password),
    onSuccess: (session) => {
      setSession(session);
      const from = (location.state as LoginLocationState | null)?.from?.pathname;
      navigate(postLoginPath(session.user.roles, from), { replace: true });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        message: getApiErrorMessage(error)
      });
    }
  });

  useEffect(() => {
    if (user) {
      navigate(postLoginPath(user.roles), { replace: true });
    }
  }, [navigate, user]);

  return (
    <Center mih="100vh" p="md" className="login-screen">
      <Paper withBorder radius="xl" className="login-panel">
        <div className="login-visual">
          <div className="login-slides" aria-hidden="true">
            <span className="login-slide login-slide-1" />
            <span className="login-slide login-slide-2" />
            <span className="login-slide login-slide-3" />
          </div>
          <Stack gap="xl" className="login-visual-content">
            <Group gap="lg" className="login-brand">
              <BrandLogo className="brand-logo--login" />
              <Title order={1} className="login-brand-title">
                OmniHR
              </Title>
            </Group>
          </Stack>
          <Stack gap="md" className="login-visual-bottom">
            <Stack gap="sm" className="login-points">
              <Group gap="sm" className="login-slogan-row">
                <ShieldCheck size={18} />
                <Text>{tx("People first. Clarity every day.")}</Text>
              </Group>
              <Group gap="sm" className="login-slogan-row">
                <Users size={18} />
                <Text>{tx("Better data, stronger teams.")}</Text>
              </Group>
            </Stack>
            <Group gap={8} className="login-slide-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </Group>
          </Stack>
        </div>

        <form
          className="login-form"
          onSubmit={form.onSubmit((values) => mutation.mutate(values))}
        >
          <Stack gap="xl" className="login-form-inner">
            <Stack gap={4} className="login-form-heading">
              <Title order={2}>{tx("Login")}</Title>
              <Text c="dimmed" size="sm">
                {tx("Use your system account to continue.")}
              </Text>
            </Stack>
            <TextInput
              size="md"
              radius="xl"
              label={tx("Username or email")}
              placeholder="superadmin"
              {...form.getInputProps("usernameOrEmail")}
            />
            <PasswordInput
              size="md"
              radius="xl"
              label={tx("Password")}
              placeholder={tx("Password")}
              {...form.getInputProps("password")}
            />
            <Button
              type="submit"
              size="md"
              radius="xl"
              leftSection={<LogIn size={17} />}
              loading={mutation.isPending}
              fullWidth
            >
              {tx("Login")}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}

function postLoginPath(roles: RoleName[], from?: string) {
  if (from && canReturnToPath(roles, from)) {
    return from;
  }
  if (roles.includes("ADMIN")) {
    return "/admin/dashboard";
  }
  if (roles.includes("MANAGER")) {
    return "/app/dashboard";
  }
  return "/employee-web-notice";
}

function canReturnToPath(roles: RoleName[], path: string) {
  if (path.startsWith("/admin")) {
    return roles.includes("ADMIN");
  }
  if (path.startsWith("/app")) {
    return roles.includes("MANAGER");
  }
  if (path.startsWith("/employee-web-notice")) {
    return roles.includes("EMPLOYEE") && !roles.includes("ADMIN") && !roles.includes("MANAGER");
  }
  return false;
}
