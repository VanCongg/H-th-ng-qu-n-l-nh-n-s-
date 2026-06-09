import { Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  title = "No records",
  description = "There is nothing to show for the current filters.",
  action
}: EmptyStateProps) {
  const { tx } = useTranslation();

  return (
    <Stack align="center" gap="xs" py="xl" className="empty-state">
      <ThemeIcon size={42} radius="md" variant="light" color="gray">
        <Inbox size={22} />
      </ThemeIcon>
      <Title order={4}>{tx(title)}</Title>
      <Text c="dimmed" size="sm" ta="center">
        {tx(description)}
      </Text>
      {action ? <Button.Group>{action}</Button.Group> : null}
    </Stack>
  );
}
