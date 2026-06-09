import { Badge, Group, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
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

export function AuditLogsPage() {
  const { tx } = useTranslation();
  const [action, setAction] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const query = useQuery({
    queryKey: ["audit-logs", action, entityType],
    queryFn: () => auditLogsApi.list({ action, entityType: entityType || undefined, limit: 100 })
  });

  return (
    <Stack gap="md">
      <PageHeader title="Audit Logs" description="Review important system actions." />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Group align="flex-end">
          <Select label={tx("Action")} data={actionOptions.map((value) => ({ value, label: tx(value) }))} clearable value={action} onChange={setAction} />
          <TextInput label={tx("Entity type")} value={entityType} onChange={(event) => setEntityType(event.currentTarget.value)} />
        </Group>
      </Paper>
      <DataTable<AuditLog>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        columns={[
          { key: "time", label: "Time", render: (item) => formatDateTime(item.createdAt) },
          { key: "action", label: "Action", render: (item) => <Badge variant="light">{tx(item.action)}</Badge> },
          { key: "entity", label: "Entity", render: (item) => `${item.entityType} #${item.entityId ?? "-"}` },
          { key: "user", label: "User", render: (item) => item.user?.username ?? "-" },
          { key: "ip", label: "IP", render: (item) => item.ipAddress ?? "-" },
          { key: "values", label: "Values", render: (item) => <Text size="xs" lineClamp={2}>{JSON.stringify(item.newValue ?? item.oldValue ?? {})}</Text> }
        ]}
      />
    </Stack>
  );
}
