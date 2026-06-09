import { Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  detail?: string;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  detail
}: StatCardProps) {
  const { tx } = useTranslation();

  return (
    <Paper withBorder radius="md" p="md" className="stat-card">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">
            {tx(label)}
          </Text>
          <Text fw={800} fz={28} lh={1.1}>
            {value}
          </Text>
          {detail ? (
            <Text size="xs" c="dimmed">
              {tx(detail)}
            </Text>
          ) : null}
        </Stack>
        <ThemeIcon size={42} radius="md" variant="light" color={color}>
          <Icon size={22} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
