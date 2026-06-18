import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, employeesApi, projectsApi, teamsApi } from "../../api/endpoints";
import { formatDate, formatDepartmentName, formatTeamName, statusColor } from "../../api/format";
import type { Project, ProjectStatus } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

const projectStatuses: ProjectStatus[] = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED"
];

type ProjectsPageProps = {
  scope: "all" | "team";
};

export function ProjectsPage({ scope }: ProjectsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const canCreate = hasPermission("PROJECT_CREATE");
  const canUpdate = hasPermission("PROJECT_UPDATE");
  const canDelete = hasPermission("PROJECT_DELETE");

  const projectsQuery = useQuery({
    queryKey: ["projects", scope, search, status, teamId, page],
    queryFn: () =>
      projectsApi.list({
        search: search || undefined,
        status: status || undefined,
        teamId: teamId ? Number(teamId) : undefined,
        page,
        limit: 20
      })
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list()
  });
  const teamsQuery = useQuery({
    queryKey: ["teams", "project-options"],
    queryFn: () => teamsApi.list({ limit: 100 })
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", scope, "project-managers"],
    queryFn: () =>
      scope === "team"
        ? employeesApi.team({ limit: 100 })
        : employeesApi.list({ limit: 100 })
  });
  const selfEmployeeQuery = useQuery({
    queryKey: ["employees", "self", "project-manager"],
    queryFn: employeesApi.me,
    enabled: scope === "team" && Boolean(user?.employeeId)
  });

  const form = useForm({
    initialValues: {
      code: "",
      name: "",
      description: "",
      status: "ACTIVE" as ProjectStatus,
      departmentId: "",
      teamId: "",
      managerId: "",
      startDate: "",
      endDate: ""
    },
    validate: {
      code: (value) => (value.trim() ? null : tx("Required")),
      name: (value) => (value.trim() ? null : tx("Required"))
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizeProjectPayload(values);
      return editing
        ? projectsApi.update(editing.id, payload)
        : projectsApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Project saved") });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Project disabled") });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({
      code: "",
      name: "",
      description: "",
      status: "ACTIVE",
      departmentId: "",
      teamId: "",
      managerId: "",
      startDate: "",
      endDate: ""
    });
    setOpened(true);
  }

  function openEdit(item: Project) {
    setEditing(item);
    form.setValues({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      status: item.status,
      departmentId: item.departmentId ? String(item.departmentId) : "",
      teamId: item.teamId ? String(item.teamId) : "",
      managerId: item.managerId ? String(item.managerId) : "",
      startDate: item.startDate?.slice(0, 10) ?? "",
      endDate: item.endDate?.slice(0, 10) ?? ""
    });
    setOpened(true);
  }

  const departmentOptions = (departmentsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: formatDepartmentName(item, tx)
  }));
  const teamItems = teamsQuery.data?.items ?? [];
  const teamOptions = teamItems
    .filter(
      (item) =>
        item.isActive &&
        (!form.values.departmentId || String(item.departmentId) === form.values.departmentId)
    )
    .map((item) => ({
      value: String(item.id),
      label: formatTeamName(item)
    }));
  const filterTeamOptions = teamItems.map((item) => ({
    value: String(item.id),
    label: formatTeamName(item)
  }));
  const selectedTeam = teamItems.find((item) => String(item.id) === form.values.teamId);
  const selectedTeamEmployeeIds = new Set(
    selectedTeam
      ? [
          ...(selectedTeam.leadId ? [selectedTeam.leadId] : []),
          ...(selectedTeam.members?.map((member) => member.employeeId) ?? [])
        ].map(String)
      : []
  );
  const managerItems = [
    ...(selfEmployeeQuery.data ? [selfEmployeeQuery.data] : []),
    ...(employeesQuery.data?.items ?? [])
  ]
    .filter(
      (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
    )
    .filter(
      (item) =>
        !selectedTeamEmployeeIds.size || selectedTeamEmployeeIds.has(String(item.id))
    );
  const managerOptions = managerItems.map((item) => ({
    value: String(item.id),
    label: `${item.fullName} (${item.employeeCode})`
  }));

  function handleDepartmentChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("departmentId", nextValue);
    const currentTeam = teamItems.find((item) => String(item.id) === form.values.teamId);
    if (!currentTeam || String(currentTeam.departmentId) !== nextValue) {
      form.setFieldValue("teamId", "");
    }
  }

  function handleTeamChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("teamId", nextValue);
    const team = teamItems.find((item) => String(item.id) === nextValue);
    if (team) {
      form.setFieldValue("departmentId", String(team.departmentId));
      if (team.leadId && !form.values.managerId) {
        form.setFieldValue("managerId", String(team.leadId));
      }
    }
  }

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "Projects" : "Projects"}
        description={
          scope === "team"
            ? "Browse and maintain projects within your manager scope."
            : "Create, update, and monitor projects across the organization."
        }
        actions={
          canCreate ? (
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              {tx("New project")}
            </Button>
          ) : null
        }
      />

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <TextInput
            label={tx("Search")}
            placeholder={tx("Search by name or code")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Status")}
            data={projectStatuses.map((value) => ({ value, label: te(value) }))}
            clearable
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Team")}
            data={filterTeamOptions}
            clearable
            searchable
            value={teamId}
            onChange={(value) => {
              setTeamId(value);
              setPage(1);
            }}
          />
        </SimpleGrid>
      </Paper>

      <DataTable<Project>
        data={projectsQuery.data?.items ?? []}
        loading={projectsQuery.isLoading}
        error={projectsQuery.error ? getApiErrorMessage(projectsQuery.error) : null}
        total={projectsQuery.data?.meta.total}
        limit={projectsQuery.data?.meta.limit}
        page={projectsQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "project",
            label: "Project",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.name}</Text>
                <Text size="xs" c="dimmed">
                  {item.code}
                </Text>
              </Stack>
            )
          },
          {
            key: "status",
            label: "Status",
            render: (item) => (
              <Badge color={statusColor(item.status)}>{te(item.status)}</Badge>
            )
          },
          { key: "department", label: "Department", render: (item) => formatDepartmentName(item.department, tx) },
          { key: "team", label: "Team", render: (item) => formatTeamName(item.team) },
          { key: "manager", label: "Manager", render: (item) => item.manager?.fullName ?? "-" },
          {
            key: "dates",
            label: "Dates",
            render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
          },
          { key: "tasks", label: "Tasks", render: (item) => item._count?.tasks ?? 0 },
          {
            key: "actions",
            label: "",
            width: 96,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                {canUpdate ? (
                  <Tooltip label={tx("Edit")}>
                    <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                      <Edit size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
                {canDelete ? (
                  <Tooltip label={tx("Disable")}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        openConfirmModal({
                          title: tx("Disable project"),
                          message: `${tx("Disable")} ${item.name}?`,
                          confirmLabel: tx("Disable"),
                          onConfirm: () => deleteMutation.mutate(item.id)
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
              </Group>
            )
          }
        ]}
      />

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? tx("Edit project") : tx("New project")}
        size="lg"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
              <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
              <Select
                label={tx("Status")}
                data={projectStatuses.map((value) => ({ value, label: te(value) }))}
                allowDeselect={false}
                {...form.getInputProps("status")}
              />
              <Select
                label={tx("Department")}
                data={departmentOptions}
                clearable
                searchable
                value={form.values.departmentId || null}
                onChange={handleDepartmentChange}
              />
              <Select
                label={tx("Team")}
                data={teamOptions}
                clearable
                searchable
                value={form.values.teamId || null}
                onChange={handleTeamChange}
              />
              <Select
                label={tx("Manager")}
                data={managerOptions}
                clearable
                searchable
                {...form.getInputProps("managerId")}
              />
              <TextInput label={tx("Start date")} type="date" {...form.getInputProps("startDate")} />
              <TextInput label={tx("End date")} type="date" {...form.getInputProps("endDate")} />
            </SimpleGrid>
            <Textarea
              label={tx("Description")}
              autosize
              minRows={3}
              {...form.getInputProps("description")}
            />
            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function normalizeProjectPayload(values: {
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  departmentId: string;
  teamId: string;
  managerId: string;
  startDate: string;
  endDate: string;
}) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    status: values.status,
    departmentId: values.departmentId ? Number(values.departmentId) : undefined,
    teamId: values.teamId ? Number(values.teamId) : undefined,
    managerId: values.managerId ? Number(values.managerId) : undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined
  };
}
