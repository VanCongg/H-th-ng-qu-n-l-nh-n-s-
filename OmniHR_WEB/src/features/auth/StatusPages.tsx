import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { ArrowLeft, ShieldAlert, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";

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
  const { tx } = useTranslation();
  const navigate = useNavigate();

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
          <Button leftSection={<ArrowLeft size={16} />} onClick={() => navigate("/login")}>
            {tx("Login")}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
