import { ActionIcon, Badge, Divider, Group, Menu, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { Bell } from "lucide-react";
import { formatDateTime } from "../../api/format";
import { useTranslation } from "../../i18n";
import { useNotificationsStore } from "../../store/notifications";
import { notificationMessage, notificationTitle } from "./notificationText";

export function NotificationBell() {
  const { tx, te, language } = useTranslation();
  const items = useNotificationsStore((state) => state.items);
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);

  return (
    <Menu width={340} position="bottom-end" radius="md" shadow="lg">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" pos="relative" aria-label={tx("Notifications")}>
          <Bell size={18} />
          {unreadCount > 0 ? (
            <Badge
              size="xs"
              circle
              color="red"
              pos="absolute"
              top={-2}
              right={-2}
              style={{ pointerEvents: "none" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Group justify="space-between" p="sm">
          <Text fw={700} size="sm">
            {tx("Notifications")}
          </Text>
          {unreadCount > 0 ? (
            <UnstyledButton onClick={() => markAllRead()}>
              <Text size="xs" c="blue">
                {tx("Mark all read")}
              </Text>
            </UnstyledButton>
          ) : null}
        </Group>
        <Divider />
        <ScrollArea.Autosize mah={360}>
          <Stack gap={0} p={4}>
            {items.length === 0 ? (
              <Text c="dimmed" size="sm" p="md" ta="center">
                {tx("No notifications yet")}
              </Text>
            ) : (
              items.map((item) => (
                <UnstyledButton
                  key={item.id}
                  onClick={() => (item.isRead ? undefined : markRead(item.id))}
                  p="sm"
                  style={{
                    borderRadius: 8,
                    backgroundColor: item.isRead ? "transparent" : "var(--mantine-color-blue-light)"
                  }}
                >
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      {notificationTitle(language, item.type, item.title)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {notificationMessage(language, item.type, item.message)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {te(item.type)} · {formatDateTime(item.createdAt)}
                    </Text>
                  </Stack>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
