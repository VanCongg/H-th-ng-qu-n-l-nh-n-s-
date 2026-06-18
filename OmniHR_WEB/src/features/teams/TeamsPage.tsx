import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, employeesApi, teamsApi } from "../../api/endpoints";
import { formatDepartmentName } from "../../api/format";
import type { Employee, Team, TeamMember } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { EmployeeAvatar } from "../../components/EmployeeAvatar";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

type TeamsPageProps = {
  scope: "all" | "managed";
};

export function TeamsPage({ scope }: TeamsPageProps) {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);
  const [opened, setOpened] = useState(false);
  const [viewing, setViewing] = useState<Team | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const isAdminScope = scope === "all" && Boolean(user?.roles.includes("ADMIN"));

  const teamsQuery = useQuery({
    queryKey: ["teams", search, departmentId, page],
    queryFn: () =>
      teamsApi.list({
        search: search || undefined,
        departmentId: departmentId ? Number(departmentId) : undefined,
        page,
        limit: 20
      })
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments", "team-form"],
    queryFn: () => departmentsApi.list()
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", scope, "team-form"],
    queryFn: () =>
      scope === "all"
        ? employeesApi.list({ limit: 100 })
        : employeesApi.team({ limit: 100 })
  });
  const selfEmployeeQuery = useQuery({
    queryKey: ["employees", "self", "team-form"],
    queryFn: employeesApi.me,
    enabled: scope === "managed" && Boolean(user?.employeeId)
  });

  const form = useForm({
    initialValues: {
      code: "",
      name: "",
      description: "",
      departmentId: "",
      leadId: "",
      memberIds: [] as string[],
      isActive: true
    },
    validate: {
      code: (value) => (value.trim() ? null : tx("Required")),
      name: (value) => (value.trim() ? null : tx("Required")),
      departmentId: (value) => (value ? null : tx("Required"))
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizeTeamPayload(values);
      return editing ? teamsApi.update(editing.id, payload) : teamsApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Team saved") });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const deleteMutation = useMutation({
    mutationFn: teamsApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Team disabled") });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    const defaultDepartmentId = managedDepartmentIds[0] ?? "";
    form.setValues({
      code: "",
      name: "",
      description: "",
      departmentId: defaultDepartmentId,
      leadId: "",
      memberIds: [],
      isActive: true
    });
    setOpened(true);
  }

  function openEdit(item: Team) {
    setEditing(item);
    form.setValues({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      departmentId: String(item.departmentId),
      leadId: item.leadId ? String(item.leadId) : "",
      memberIds: item.members?.map((member) => String(member.employeeId)) ?? [],
      isActive: item.isActive
    });
    setOpened(true);
  }

  function applySearch() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  function handleDepartmentChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("departmentId", nextValue);
    const allowedIds = new Set(
      employeeItems
        .filter((employee) => String(employee.departmentId) === nextValue)
        .map((employee) => String(employee.id))
    );
    if (!allowedIds.has(form.values.leadId)) {
      form.setFieldValue("leadId", "");
    }
    form.setFieldValue(
      "memberIds",
      form.values.memberIds.filter((employeeId) => allowedIds.has(employeeId))
    );
  }

  const departmentOptions = (departmentsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: formatDepartmentName(item, tx)
  }));
  const managedDepartmentIds = (departmentsQuery.data ?? [])
    .filter((department) => isAdminScope || department.managerId === user?.employeeId)
    .map((department) => String(department.id));
  const editableDepartmentOptions = departmentOptions.filter(
    (option) => isAdminScope || managedDepartmentIds.includes(option.value)
  );
  const employeeItems = [
    ...(selfEmployeeQuery.data ? [selfEmployeeQuery.data] : []),
    ...(employeesQuery.data?.items ?? [])
  ].filter(
    (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
  );
  const formEmployeeOptions = employeeItems
    .filter((employee) => !form.values.departmentId || String(employee.departmentId) === form.values.departmentId)
    .map((employee) => employeeOption(employee));
  const canCreate =
    hasPermission("TEAM_CREATE") && (isAdminScope || managedDepartmentIds.length > 0);
  const canDelete = hasPermission("TEAM_DELETE") && isAdminScope;

  function canUpdateTeam(item: Team) {
    return (
      hasPermission("TEAM_UPDATE") &&
      (isAdminScope || managedDepartmentIds.includes(String(item.departmentId)))
    );
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Teams"
        description={
          scope === "all"
            ? "Create squads inside departments and assign team leads."
            : "View department teams, leads, and members within your organization scope."
        }
        actions={
          canCreate ? (
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              {tx("New team")}
            </Button>
          ) : null
        }
      />

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              placeholder={tx("Search by name or code")}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
              style={{ flex: "1 1 260px" }}
            />
            <Select
              placeholder={tx("Department")}
              data={departmentOptions}
              value={departmentId}
              onChange={(value) => {
                setDepartmentId(value);
                setPage(1);
              }}
              clearable
              searchable
              style={{ flex: "0 1 240px" }}
            />
            <Button type="submit" leftSection={<Search size={16} />}>
              {tx("Search")}
            </Button>
          </Group>
        </form>
      </Paper>

      <DataTable<Team>
        data={teamsQuery.data?.items ?? []}
        loading={teamsQuery.isLoading}
        error={teamsQuery.error ? getApiErrorMessage(teamsQuery.error) : null}
        total={teamsQuery.data?.meta.total}
        limit={teamsQuery.data?.meta.limit}
        page={teamsQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "team",
            label: "Team",
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
            key: "department",
            label: "Department",
            render: (item) => formatDepartmentName(item.department, tx)
          },
          {
            key: "lead",
            label: "Team lead",
            render: (item) => item.lead?.fullName ?? "-"
          },
          {
            key: "members",
            label: "Members",
            render: (item) => item._count?.members ?? item.members?.length ?? 0
          },
          {
            key: "work",
            label: "Projects",
            render: (item) => (
              <Group gap={4}>
                <Badge variant="light">{item._count?.projects ?? 0}</Badge>
                <Text size="xs" c="dimmed">
                  {tx("Tasks")}: {item._count?.tasks ?? 0}
                </Text>
              </Group>
            )
          },
          {
            key: "active",
            label: "Active",
            render: (item) => (item.isActive ? tx("Yes") : tx("No"))
          },
          {
            key: "actions",
            label: "",
            width: 128,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                <Tooltip label={tx("View")}>
                  <ActionIcon variant="subtle" color="blue" onClick={() => setViewing(item)}>
                    <Eye size={16} />
                  </ActionIcon>
                </Tooltip>
                {canUpdateTeam(item) ? (
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
                          title: tx("Disable team"),
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
        title={editing ? tx("Edit team") : tx("New team")}
        size="lg"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
              <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
              <Select
                label={tx("Department")}
                data={editableDepartmentOptions}
                required
                searchable
                disabled={!isAdminScope && editableDepartmentOptions.length <= 1}
                value={form.values.departmentId || null}
                onChange={handleDepartmentChange}
                error={form.errors.departmentId}
              />
              <Select
                label={tx("Team lead")}
                data={formEmployeeOptions}
                searchable
                clearable
                disabled={!form.values.departmentId}
                value={form.values.leadId || null}
                onChange={(value) => form.setFieldValue("leadId", value ?? "")}
              />
            </SimpleGrid>
            <MultiSelect
              label={tx("Members")}
              data={formEmployeeOptions}
              searchable
              clearable
              disabled={!form.values.departmentId}
              value={form.values.memberIds}
              onChange={(value) => form.setFieldValue("memberIds", value)}
            />
            <Textarea
              label={tx("Description")}
              autosize
              minRows={3}
              {...form.getInputProps("description")}
            />
            <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.code} - ${viewing.name}` : tx("Team")}
        size="min(1040px, 96vw)"
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed">
                {tx("Department")}
              </Text>
              <Text fw={700}>{formatDepartmentName(viewing?.department, tx)}</Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed">
                {tx("Team lead")}
              </Text>
              {viewing?.lead ? (
                <Group gap="sm" wrap="nowrap" mt={6}>
                  <EmployeeAvatar employee={viewing.lead} />
                  <Stack gap={0}>
                    <Text fw={700}>{viewing.lead.fullName}</Text>
                    <Text size="xs" c="dimmed">
                      {viewing.lead.employeeCode}
                    </Text>
                  </Stack>
                </Group>
              ) : (
                <Text fw={700}>-</Text>
              )}
            </Paper>
          </SimpleGrid>
          <DataTable<TeamMember>
            data={viewing?.members ?? []}
            columns={[
              {
                key: "employee",
                label: "Employee",
                render: (item) => (
                  <Group gap="sm" wrap="nowrap">
                    <EmployeeAvatar employee={item.employee} />
                    <Stack gap={0}>
                      <Text fw={700}>{item.employee.fullName}</Text>
                      <Text size="xs" c="dimmed">
                        {item.employee.employeeCode}
                      </Text>
                    </Stack>
                  </Group>
                )
              },
              { key: "role", label: "Role", render: (item) => <Badge>{item.role}</Badge> },
              {
                key: "position",
                label: "Position",
                render: (item) => item.employee.position?.name ?? "-"
              }
            ]}
          />
        </Stack>
      </Modal>
    </Stack>
  );
}

function employeeOption(employee: Employee) {
  return {
    value: String(employee.id),
    label: `${employee.fullName} (${employee.employeeCode})`
  };
}

function normalizeTeamPayload(values: {
  code: string;
  name: string;
  description: string;
  departmentId: string;
  leadId: string;
  memberIds: string[];
  isActive: boolean;
}) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    departmentId: Number(values.departmentId),
    leadId: values.leadId ? Number(values.leadId) : undefined,
    memberIds: values.memberIds.map(Number),
    isActive: values.isActive
  };
}
