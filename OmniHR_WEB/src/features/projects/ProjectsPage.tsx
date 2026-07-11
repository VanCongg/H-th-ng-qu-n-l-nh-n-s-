import {
  ActionIcon,
  Badge,
  Button,
  Divider,
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
import { Edit, Eye, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { employeesApi, projectsApi } from "../../api/endpoints";
import { formatDate, formatDepartmentName, statusColor } from "../../api/format";
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
  const [viewing, setViewing] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const canCreate = hasPermission("PROJECT_CREATE") && Boolean(user?.employeeId);
  const canUpdate = hasPermission("PROJECT_UPDATE");
  const canDelete = hasPermission("PROJECT_DELETE");

  const projectsQuery = useQuery({
    queryKey: ["projects", scope, search, status, page],
    queryFn: () =>
      projectsApi.list({
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 20
      })
  });
  const selfEmployeeQuery = useQuery({
    queryKey: ["employees", "self", "project-manager"],
    queryFn: employeesApi.me,
    enabled: Boolean(user?.employeeId)
  });

  const form = useForm({
    initialValues: {
      code: "",
      name: "",
      description: "",
      status: "ACTIVE" as ProjectStatus,
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
      startDate: item.startDate?.slice(0, 10) ?? "",
      endDate: item.endDate?.slice(0, 10) ?? ""
    });
    setOpened(true);
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
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
                <Text fw={700} lineClamp={1}>
                  {item.name}
                </Text>
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
          {
            key: "dates",
            label: "Dates",
            render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
          },
          { key: "tasks", label: "Tasks", render: (item) => item._count?.tasks ?? 0 },
          {
            key: "actions",
            label: "",
            width: 128,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                <Tooltip label={tx("View details")}>
                  <ActionIcon variant="subtle" color="blue" onClick={() => setViewing(item)}>
                    <Eye size={16} />
                  </ActionIcon>
                </Tooltip>
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
        opened={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={tx("Project details")}
        size="lg"
      >
        {viewing ? (
          <Stack>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={800} size="lg">
                  {viewing.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {viewing.code}
                </Text>
              </Stack>
              <Badge color={statusColor(viewing.status)}>{te(viewing.status)}</Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DetailItem
                label={tx("Department")}
                value={formatDepartmentName(viewing.department, tx)}
              />
              <DetailItem
                label={tx("Department head")}
                value={viewing.manager?.fullName ?? "-"}
              />
              <DetailItem label={tx("Start date")} value={formatDate(viewing.startDate)} />
              <DetailItem label={tx("End date")} value={formatDate(viewing.endDate)} />
              <DetailItem label={tx("Tasks")} value={viewing._count?.tasks ?? 0} />
            </SimpleGrid>
            <Divider label={tx("Description")} labelPosition="left" />
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {viewing.description || "-"}
            </Text>
          </Stack>
        ) : null}
      </Modal>

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
              <TextInput
                label={tx("Department")}
                value={formatDepartmentName(
                  editing?.department ?? selfEmployeeQuery.data?.department,
                  tx
                )}
                readOnly
                description={tx("Automatically determined from the department head")}
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

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} component="div">
        {value}
      </Text>
    </Paper>
  );
}

function normalizeProjectPayload(values: {
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
}) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    status: values.status,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined
  };
}
