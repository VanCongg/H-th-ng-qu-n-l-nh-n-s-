import { Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardList, Users } from "lucide-react";
import { dashboardApi } from "../../api/endpoints";
import {
  formatDate,
  formatDepartmentName,
  formatEmployeeJobTitle
} from "../../api/format";
import { getApiErrorMessage } from "../../api/axios";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { useTranslation } from "../../i18n";
import type { Employee, LeaveRequest } from "../../api/types";

export function AppDashboardPage() {
  const { te, tx } = useTranslation();
  const query = useQuery({
    queryKey: ["manager-dashboard"],
    queryFn: dashboardApi.manager
  });
  const data = query.data;

  return (
    <Stack gap="md">
      <PageHeader
        title="Dashboard"
        description="Team summary, attendance signals, and pending leave requests."
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard label="Subordinates" value={data?.teamEmployees ?? 0} icon={Users} color="blue" />
        <StatCard label="Pending Team Leave" value={data?.pendingTeamLeaves ?? 0} icon={ClipboardList} color="yellow" />
        <StatCard label="Attendance Today" value={data?.todayTeamAttendance ?? 0} icon={Activity} color="teal" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>{tx("Latest Leave Requests")}</Title>
              <Badge variant="light">{data?.latestTeamLeaves?.length ?? 0}</Badge>
            </Group>
            <DataTable<LeaveRequest>
              loading={query.isLoading}
              error={query.error ? getApiErrorMessage(query.error) : null}
              data={data?.latestTeamLeaves ?? []}
              emptyTitle="No team leave requests"
              columns={[
                { key: "employee", label: "Employee", render: (item) => item.employee.fullName },
                { key: "type", label: "Type", render: (item) => item.leaveType.name },
                { key: "dates", label: "Dates", render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` },
                { key: "status", label: "Status", render: (item) => <Badge color={item.status === "PENDING" ? "yellow" : "green"}>{te(item.status)}</Badge> }
              ]}
            />
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>{tx("Subordinates")}</Title>
              <Badge variant="light">{data?.latestSubordinates?.length ?? 0}</Badge>
            </Group>
            <DataTable<Employee>
              loading={query.isLoading}
              error={query.error ? getApiErrorMessage(query.error) : null}
              data={data?.latestSubordinates ?? []}
              emptyTitle="No subordinates"
              columns={[
                { key: "code", label: "Code", render: (item) => item.employeeCode },
                { key: "name", label: "Name", render: (item) => <Text fw={700}>{item.fullName}</Text> },
                { key: "department", label: "Department", render: (item) => formatDepartmentName(item.department, tx) },
                { key: "position", label: "Position", render: (item) => formatEmployeeJobTitle(item, te) }
              ]}
            />
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
