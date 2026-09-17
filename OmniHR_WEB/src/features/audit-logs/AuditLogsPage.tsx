import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { auditLogsApi } from "../../api/endpoints";
import { formatDateTime } from "../../api/format";
import type { AuditLog } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

const actionOptions = [
  "LOGIN",
  "LOGOUT",
  "CREATE_EMPLOYEE",
  "UPDATE_EMPLOYEE",
  "DELETE_EMPLOYEE",
  "ASSIGN_MANAGER",
  "CREATE_LEAVE_REQUEST",
  "APPROVE_LEAVE_REQUEST",
  "REJECT_LEAVE_REQUEST",
  "CHECK_IN",
  "CHECK_OUT"
];

function actionColor(action: string) {
  if (action.includes("DELETE") || action.includes("REJECT") || action.includes("CANCEL")) {
    return "red";
  }

  if (action.includes("CREATE") || action.includes("CHECK_IN")) {
    return "green";
  }

  if (action.includes("UPDATE") || action.includes("ASSIGN") || action.includes("APPROVE")) {
    return "blue";
  }

  if (action.includes("LOGIN") || action.includes("LOGOUT")) {
    return "teal";
  }

  return "gray";
}

function formatAuditPayload(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compactAuditPayload(value: unknown) {
  const formatted = formatAuditPayload(value);
  if (formatted === "-") {
    return formatted;
  }

  const compact = formatted.replace(/\s+/g, " ").trim();
  return compact.length > 150 ? `${compact.slice(0, 150)}...` : compact;
}

function AuditPayloadPreview({ log }: { log: AuditLog }) {
  const value = log.newValue ?? log.oldValue;
  const preview = compactAuditPayload(value);

  // An empty bordered box per row looked like a broken input.
  if (preview === "-") {
    return (
      <Text size="xs" c="dimmed">
        -
      </Text>
    );
  }

  return (
    <Box className="audit-payload-preview">
      <Text size="xs" lineClamp={3} c={preview === "-" ? "dimmed" : undefined}>
        {preview}
      </Text>
    </Box>
  );
}

export function AuditLogsPage() {
  const { tx } = useTranslation();
  const [action, setAction] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const query = useQuery({
    queryKey: ["audit-logs", action, entityType, page],
    queryFn: () =>
      auditLogsApi.list({
        action,
        entityType: entityType || undefined,
        page,
        limit: 20
      })
  });

  return (
    <Stack gap="md">
      <PageHeader title="Audit Logs" description="Review important system actions." />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label={tx("Action")}
            placeholder={tx("All actions")}
            data={actionOptions.map((value) => ({ value, label: tx(value) }))}
            clearable
            value={action}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          />
          <TextInput
            label={tx("Entity type")}
            placeholder={tx("Example: User, Task, LeaveRequest")}
            value={entityType}
            onChange={(event) => {
              setEntityType(event.currentTarget.value);
              setPage(1);
            }}
          />
        </SimpleGrid>
      </Paper>
      <DataTable<AuditLog>
        className="audit-log-table"
        tableMinWidth={1120}
        rowKey={(item) => item.id}
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "time",
            label: "Time",
            width: 170,
            render: (item) => <Text size="sm" fw={600}>{formatDateTime(item.createdAt)}</Text>
          },
          {
            key: "action",
            label: "Action",
            width: 210,
            render: (item) => (
              <Badge color={actionColor(item.action)} variant="light" className="audit-action-badge">
                {tx(item.action)}
              </Badge>
            )
          },
          {
            key: "entity",
            label: "Entity",
            width: 180,
            render: (item) => (
              <Stack gap={0}>
                <Text size="sm" fw={700}>{item.entityType}</Text>
                <Text size="xs" c="dimmed">#{item.entityId ?? "-"}</Text>
              </Stack>
            )
          },
          {
            key: "user",
            label: "User",
            width: 150,
            render: (item) => item.user?.username ?? "-"
          },
          {
            key: "ip",
            label: "IP",
            width: 140,
            render: (item) => <Text size="sm" c={item.ipAddress ? undefined : "dimmed"}>{item.ipAddress ?? "-"}</Text>
          },
          {
            key: "values",
            label: "Values",
            render: (item) => <AuditPayloadPreview log={item} />
          },
          {
            key: "actions",
            label: "",
            width: 72,
            render: (item) => (
              <Group justify="flex-end">
                <Tooltip label={tx("View details")}>
                  <ActionIcon variant="subtle" onClick={() => setSelectedLog(item)}>
                    <Eye size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
      <Modal
        opened={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={tx("View details")}
        size="xl"
      >
        {selectedLog ? (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("Action")}</Text>
                <Badge color={actionColor(selectedLog.action)} variant="light">
                  {tx(selectedLog.action)}
                </Badge>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("Time")}</Text>
                <Text size="sm" fw={700}>{formatDateTime(selectedLog.createdAt)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("Entity")}</Text>
                <Text size="sm" fw={700}>
                  {selectedLog.entityType} #{selectedLog.entityId ?? "-"}
                </Text>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("User")}</Text>
                <Text size="sm" fw={700}>{selectedLog.user?.username ?? "-"}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("IP")}</Text>
                <Text size="sm" fw={700}>{selectedLog.ipAddress ?? "-"}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("User agent")}</Text>
                <Text size="sm" lineClamp={2}>{selectedLog.userAgent ?? "-"}</Text>
              </Paper>
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="xs">
                <Text fw={700}>{tx("Old value")}</Text>
                <Box component="pre" className="admin-json-block">
                  {formatAuditPayload(selectedLog.oldValue)}
                </Box>
              </Stack>
              <Stack gap="xs">
                <Text fw={700}>{tx("New value")}</Text>
                <Box component="pre" className="admin-json-block">
                  {formatAuditPayload(selectedLog.newValue)}
                </Box>
              </Stack>
            </SimpleGrid>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
