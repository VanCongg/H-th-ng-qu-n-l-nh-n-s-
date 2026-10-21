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
  Switch,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { auditLogsApi, usersApi } from "../../api/endpoints";
import { formatDateTime } from "../../api/format";
import type { AuditLog } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import {
  auditActionCodes,
  auditEntityTypes,
  translateAuditAction,
  translateEntityType,
  useTranslation
} from "../../i18n";

/** The groups the API filters by (src/common/audit-actions.ts). */
const AUDIT_CATEGORIES = ["SECURITY", "PEOPLE", "LEAVE", "WORK", "AI"] as const;
const CATEGORY_LABELS: Record<(typeof AUDIT_CATEGORIES)[number], { en: string; vi: string }> = {
  SECURITY: { en: "Security & access", vi: "Bảo mật & phân quyền" },
  PEOPLE: { en: "People & organisation", vi: "Nhân sự & tổ chức" },
  LEAVE: { en: "Leave", vi: "Nghỉ phép" },
  WORK: { en: "Projects & tasks", vi: "Dự án & công việc" },
  AI: { en: "AI & HRGenie", vi: "AI & HRGenie" }
};

const pad = (value: number) => String(value).padStart(2, "0");
function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/** The last seven days, today included: what an admin usually looks for. */
function lastWeek() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  return { fromDate: dateKey(from), toDate: dateKey(today) };
}

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
  const { tx, ta, tn, language } = useTranslation();
  const [action, setAction] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [range, setRange] = useState(lastWeek);
  // Sign-ins, task status moves and chatbot turns hidden unless asked for.
  const [importantOnly, setImportantOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const actionOptions = useMemo(
    () =>
      auditActionCodes
        .map((value) => ({ value, label: translateAuditAction(language, value) }))
        .sort((a, b) => a.label.localeCompare(b.label, language)),
    [language]
  );
  const entityTypeOptions = useMemo(
    () =>
      auditEntityTypes
        .map((value) => ({ value, label: translateEntityType(language, value) }))
        .sort((a, b) => a.label.localeCompare(b.label, language)),
    [language]
  );
  const usersQuery = useQuery({
    queryKey: ["users", "audit-filter"],
    queryFn: () => usersApi.list({ limit: 100 })
  });
  const userOptions = (usersQuery.data?.items ?? []).map((user) => ({
    value: String(user.id),
    label: user.username
  }));
  const categoryOptions = AUDIT_CATEGORIES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value][language === "vi" ? "vi" : "en"]
  }));
  const query = useQuery({
    queryKey: ["audit-logs", action, entityType, category, userId, range, importantOnly, page],
    queryFn: () =>
      auditLogsApi.list({
        action,
        entityType: entityType || undefined,
        category: category || undefined,
        userId: userId ? Number(userId) : undefined,
        fromDate: range.fromDate || undefined,
        toDate: range.toDate || undefined,
        importantOnly,
        page,
        limit: 20
      })
  });
  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <Stack gap="md">
      <PageHeader title="Audit Logs" description="Review important system actions." />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Select
              label={tx("Group")}
              placeholder={tx("All groups")}
              data={categoryOptions}
              clearable
              value={category}
              onChange={reset(setCategory)}
            />
            <Select
              label={tx("Action")}
              placeholder={tx("All actions")}
              data={actionOptions}
              clearable
              searchable
              value={action}
              onChange={reset(setAction)}
            />
            <Select
              label={tx("Entity type")}
              placeholder={tx("All entity types")}
              data={entityTypeOptions}
              clearable
              searchable
              value={entityType || null}
              onChange={(value) => reset(setEntityType)(value ?? "")}
            />
            <Select
              label={tx("Performed by")}
              placeholder={tx("Everyone")}
              data={userOptions}
              clearable
              searchable
              value={userId}
              onChange={reset(setUserId)}
            />
          </SimpleGrid>
          <Group align="flex-end" gap="md">
            <TextInput
              label={tx("From date")}
              type="date"
              value={range.fromDate}
              onChange={(event) => reset(setRange)({ ...range, fromDate: event.currentTarget.value })}
            />
            <TextInput
              label={tx("To date")}
              type="date"
              value={range.toDate}
              onChange={(event) => reset(setRange)({ ...range, toDate: event.currentTarget.value })}
            />
            <Switch
              mb={8}
              label={tx("Only important changes")}
              description={tx("Hides sign-ins, task status moves and chatbot turns")}
              checked={importantOnly}
              onChange={(event) => reset(setImportantOnly)(event.currentTarget.checked)}
            />
          </Group>
        </Stack>
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
                {ta(item.action)}
              </Badge>
            )
          },
          {
            key: "entity",
            label: "Entity",
            width: 180,
            render: (item) => (
              <Stack gap={0}>
                <Text size="sm" fw={700}>{tn(item.entityType)}</Text>
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
                  {ta(selectedLog.action)}
                </Badge>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("Time")}</Text>
                <Text size="sm" fw={700}>{formatDateTime(selectedLog.createdAt)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm" className="audit-detail-tile">
                <Text size="xs" c="dimmed">{tx("Entity")}</Text>
                <Text size="sm" fw={700}>
                  {tn(selectedLog.entityType)} #{selectedLog.entityId ?? "-"}
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
