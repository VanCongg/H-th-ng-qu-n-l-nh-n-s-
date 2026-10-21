import { Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeCheck, Building2, ClipboardList, Users } from "lucide-react";
import { dashboardApi } from "../../api/endpoints";
import { formatDateTime } from "../../api/format";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { useTranslation } from "../../i18n";
import type { AuditLog } from "../../api/types";
import { getApiErrorMessage } from "../../api/axios";

export function AdminDashboardPage() {
  const { tx, ta, tn } = useTranslation();
  const query = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: dashboardApi.admin
  });

  const data = query.data;

  return (
    <Stack gap="md">
      <PageHeader
        title="Admin Dashboard"
        description="System-wide HR overview and latest activity."
      />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <StatCard label="Employees" value={data?.totalEmployees ?? 0} icon={Users} color="blue" />
        <StatCard label="Departments" value={data?.totalDepartments ?? 0} icon={Building2} color="teal" />
        <StatCard label="Positions" value={data?.totalPositions ?? 0} icon={BadgeCheck} color="indigo" />
        <StatCard label="Active Employees" value={data?.activeEmployees ?? 0} icon={Activity} color="green" />
        <StatCard label="Pending Leave" value={data?.pendingLeaveRequests ?? 0} icon={ClipboardList} color="yellow" />
        <StatCard label="Checked in today" value={data?.checkedInToday ?? 0} icon={Activity} color="cyan" />
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>{tx("Recent Activity")}</Title>
            <Badge variant="light">{data?.recentAuditLogs?.length ?? 0}</Badge>
          </Group>
          <DataTable<AuditLog>
            loading={query.isLoading}
            error={query.error ? getApiErrorMessage(query.error) : null}
            data={data?.recentAuditLogs ?? []}
            emptyTitle="No activity yet"
            columns={[
              { key: "action", label: "Action", render: (item) => <Text fw={700} size="sm">{ta(item.action)}</Text> },
              { key: "entity", label: "Entity", render: (item) => `${tn(item.entityType)} #${item.entityId ?? "-"}` },
              { key: "user", label: "Employee", render: (item) => item.user?.username ?? "-" },
              { key: "time", label: "Time", render: (item) => formatDateTime(item.createdAt) }
            ]}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
