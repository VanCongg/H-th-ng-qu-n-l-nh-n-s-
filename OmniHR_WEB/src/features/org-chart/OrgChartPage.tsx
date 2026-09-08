import { Badge, Group, Paper, Progress, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Percent, Users } from "lucide-react";
import { getApiErrorMessage } from "../../api/axios";
import { dashboardApi } from "../../api/endpoints";
import type { OrgChartNode } from "../../api/types";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { useTranslation } from "../../i18n";

function OrgNode({ node, depth }: { node: OrgChartNode; depth: number }) {
  const { tx } = useTranslation();

  return (
    <Stack gap="xs" ml={depth * 24}>
      <Paper withBorder radius="md" p="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Group gap={6}>
              <Text fw={700}>{node.name}</Text>
              <Badge variant="light" size="sm">
                {node.code}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {tx("Department manager")}: {node.manager?.fullName ?? tx("No manager assigned")}
            </Text>
          </Stack>
          <Badge color="blue" variant="light" leftSection={<Users size={12} />}>
            {node._count.employees}
          </Badge>
        </Group>
        {node.teams.length > 0 ? (
          <Group gap={4} mt="xs">
            {node.teams.map((team) => (
              <Badge key={team.id} variant="outline" size="sm">
                {team.name} · {team._count.members}
              </Badge>
            ))}
          </Group>
        ) : null}
      </Paper>
      {node.children.map((child) => (
        <OrgNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </Stack>
  );
}

export function OrgChartPage() {
  const { tx } = useTranslation();
  const treeQuery = useQuery({ queryKey: ["org-chart"], queryFn: dashboardApi.orgChart });
  const analyticsQuery = useQuery({
    queryKey: ["org-analytics"],
    queryFn: dashboardApi.orgAnalytics
  });

  const analytics = analyticsQuery.data;
  const maxHeadcount = Math.max(1, ...(analytics?.byDepartment.map((row) => row.headcount) ?? [1]));

  return (
    <Stack gap="md">
      <PageHeader
        title="Org Chart"
        description="Organization hierarchy and company-wide headcount signals."
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard
          label="Total headcount"
          value={analytics?.totalActiveEmployees ?? 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Attendance Today"
          value={analytics?.todayAttendance ?? 0}
          icon={Activity}
          color="cyan"
        />
        <StatCard
          label="Attendance rate"
          value={`${Math.round((analytics?.attendanceRate ?? 0) * 100)}%`}
          icon={Percent}
          color="green"
        />
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Title order={4} mb="sm">
          {tx("Headcount by department")}
        </Title>
        {analyticsQuery.error ? (
          <Text c="red" size="sm">
            {getApiErrorMessage(analyticsQuery.error)}
          </Text>
        ) : (
          <Stack gap="sm">
            {(analytics?.byDepartment ?? []).map((row) => (
              <Stack key={row.departmentId} gap={4}>
                <Group justify="space-between">
                  <Text size="sm">{row.departmentName}</Text>
                  <Text size="sm" fw={700}>
                    {row.headcount}
                  </Text>
                </Group>
                <Progress value={(row.headcount / maxHeadcount) * 100} color="blue" radius="xl" />
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Group mb="sm" gap={6}>
          <Building2 size={18} />
          <Title order={4}>{tx("Organization hierarchy")}</Title>
        </Group>
        {treeQuery.error ? (
          <Text c="red" size="sm">
            {getApiErrorMessage(treeQuery.error)}
          </Text>
        ) : (
          <Stack gap="sm">
            {(treeQuery.data ?? []).map((node) => (
              <OrgNode key={node.id} node={node} depth={0} />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
