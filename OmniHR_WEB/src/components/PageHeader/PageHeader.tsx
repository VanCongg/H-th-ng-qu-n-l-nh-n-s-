import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { tx } = useTranslation();

  return (
    <Group justify="space-between" align="flex-start" gap="md" className="page-header">
      <Stack gap={2}>
        <Title order={2}>{tx(title)}</Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {tx(description)}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="xs">{actions}</Group> : null}
    </Group>
  );
}
