import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Progress,
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
import { Edit, History, Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import {
  departmentsApi,
  employeesApi,
  projectsApi,
  skillsApi,
  taskAssignmentsApi,
  taskWorkloadApi,
  tasksApi,
  teamsApi
} from "../../api/endpoints";
import {
  formatDate,
  formatDateTime,
  formatDepartmentName,
  formatTeamName,
  statusColor
} from "../../api/format";
import type {
  EmployeeWorkload,
  SkillProficiency,
  Task,
  TaskAssignment,
  TaskPriority,
  TaskStatus,
  Team
} from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const taskStatuses: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELLED"
];
const proficiencyOptions: SkillProficiency[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT"
];

type RequiredSkillForm = {
  skillId: string;
  requiredProficiency: SkillProficiency | "";
  weight: number | string;
  isRequired: boolean;
};

type TasksPageProps = {
  scope: "all" | "team";
  mode?: "manage" | "assign";
};

export function TasksPage({ scope, mode = "manage" }: TasksPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [assigning, setAssigning] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const canCreate = hasPermission("TASK_CREATE");
  const canUpdate = hasPermission("TASK_UPDATE");
  const canDelete = hasPermission("TASK_DELETE");
  const canAssign = hasPermission("TASK_ASSIGN");
  const canUpdateStatus = hasPermission("TASK_UPDATE_STATUS");

  const tasksQuery = useQuery({
    queryKey: ["tasks", scope, search, status, priority, projectId, teamId, assigneeId, page],
    queryFn: () => {
      const params = {
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        projectId: projectId ? Number(projectId) : undefined,
        teamId: teamId ? Number(teamId) : undefined,
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        page,
        limit: 20
      };
      return scope === "team" ? tasksApi.team(params) : tasksApi.list(params);
    }
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", scope, "task-options"],
    queryFn: () => projectsApi.list({ limit: 100 })
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list()
  });
  const teamsQuery = useQuery({
    queryKey: ["teams", scope, "task-options"],
    queryFn: () => teamsApi.list({ limit: 100 })
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", scope, "task-assignees"],
    queryFn: () =>
      scope === "team"
        ? employeesApi.team({ limit: 100 })
        : employeesApi.list({ limit: 100 })
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "task-required-skills"],
    queryFn: () => skillsApi.list({ limit: 100 })
  });
  const workloadQuery = useQuery({
    queryKey: ["task-workload", scope],
    queryFn: () => taskWorkloadApi.list({ scope }),
    enabled: mode === "assign"
  });
  const assignmentsQuery = useQuery({
    queryKey: ["task-assignments", historyTask?.id],
    queryFn: () => taskAssignmentsApi.list({ taskId: historyTask?.id, limit: 50 }),
    enabled: Boolean(historyTask)
  });

  const form = useForm({
    initialValues: {
      title: "",
      description: "",
      projectId: "",
      departmentId: "",
      teamId: "",
      priority: "MEDIUM" as TaskPriority,
      status: "TODO" as TaskStatus,
      assigneeId: "",
      startDate: "",
      dueDate: "",
      estimatedHours: 4,
      actualHours: 0,
      requiredSkills: [] as RequiredSkillForm[]
    },
    validate: {
      title: (value) => (value.trim() ? null : tx("Required"))
    }
  });
  const assignForm = useForm({
    initialValues: {
      assigneeId: "",
      note: ""
    },
    validate: {
      assigneeId: (value) => (value ? null : tx("Required"))
    }
  });

  const workloadByEmployeeId = useMemo(() => {
    const map = new Map<number, EmployeeWorkload["workload"]>();
    (workloadQuery.data ?? []).forEach((item) => map.set(item.employee.id, item.workload));
    return map;
  }, [workloadQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizeTaskPayload(values);
      return editing ? tasksApi.update(editing.id, payload) : tasksApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Task saved") });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const assignMutation = useMutation({
    mutationFn: (values: typeof assignForm.values) => {
      if (!assigning) {
        throw new Error(tx("Task is required"));
      }
      return tasksApi.assign(assigning.id, {
        assigneeId: Number(values.assigneeId),
        note: values.note.trim() || undefined
      });
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Task assigned") });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
      setAssigning(null);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const statusMutation = useMutation({
    mutationFn: (values: { id: number; status: TaskStatus }) =>
      tasksApi.updateStatus(values.id, { status: values.status }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Task status updated") });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Task cancelled") });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({
      title: "",
      description: "",
      projectId: "",
      departmentId: "",
      teamId: "",
      priority: "MEDIUM",
      status: "TODO",
      assigneeId: "",
      startDate: "",
      dueDate: "",
      estimatedHours: 4,
      actualHours: 0,
      requiredSkills: []
    });
    setOpened(true);
  }

  function openEdit(item: Task) {
    setEditing(item);
    form.setValues({
      title: item.title,
      description: item.description ?? "",
      projectId: item.projectId ? String(item.projectId) : "",
      departmentId: item.departmentId ? String(item.departmentId) : "",
      teamId: item.teamId ? String(item.teamId) : "",
      priority: item.priority,
      status: item.status,
      assigneeId: item.assigneeId ? String(item.assigneeId) : "",
      startDate: item.startDate?.slice(0, 10) ?? "",
      dueDate: item.dueDate?.slice(0, 10) ?? "",
      estimatedHours: Number(item.estimatedHours ?? 4),
      actualHours: Number(item.actualHours ?? 0),
      requiredSkills:
        item.requiredSkills?.map((skill) => ({
          skillId: String(skill.skillId),
          requiredProficiency: skill.requiredProficiency ?? "",
          weight: Number(skill.weight ?? 1),
          isRequired: skill.isRequired
        })) ?? []
    });
    setOpened(true);
  }

  function openAssign(item: Task) {
    setAssigning(item);
    assignForm.setValues({
      assigneeId: item.assigneeId ? String(item.assigneeId) : "",
      note: ""
    });
  }

  const projectOptions = (projectsQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} - ${item.name}`
  }));
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
  const employeeOptions = (employeesQuery.data?.items ?? []).map((item) => {
    const workload = workloadByEmployeeId.get(item.id);
    const suffix = workload
      ? ` - ${workload.availableHours}h available, ${workload.activeTaskCount} active`
      : "";
    return {
      value: String(item.id),
      label: `${item.fullName} (${item.employeeCode})${suffix}`
    };
  });
  const formEmployeeOptions = employeeOptions.filter((option) =>
    employeeAllowedForTeam(option.value, form.values.teamId, teamItems)
  );
  const assignEmployeeOptions = employeeOptions.filter((option) =>
    employeeAllowedForTeam(option.value, assigning?.teamId ? String(assigning.teamId) : "", teamItems)
  );
  const skillOptions = (skillsQuery.data?.items ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: String(item.id),
      label: `${item.code} - ${item.name}`
    }));

  function handleProjectChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("projectId", nextValue);
    const project = projectsQuery.data?.items.find((item) => String(item.id) === nextValue);
    if (project?.departmentId) {
      form.setFieldValue("departmentId", String(project.departmentId));
    }
    if (project?.teamId) {
      form.setFieldValue("teamId", String(project.teamId));
    }
  }

  function handleDepartmentChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("departmentId", nextValue);
    const currentTeam = teamItems.find((item) => String(item.id) === form.values.teamId);
    if (!currentTeam || String(currentTeam.departmentId) !== nextValue) {
      form.setFieldValue("teamId", "");
      form.setFieldValue("assigneeId", "");
    }
  }

  function handleTeamChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("teamId", nextValue);
    const team = teamItems.find((item) => String(item.id) === nextValue);
    if (team) {
      form.setFieldValue("departmentId", String(team.departmentId));
      if (!employeeAllowedForTeam(form.values.assigneeId, nextValue, teamItems)) {
        form.setFieldValue("assigneeId", "");
      }
    }
  }

  return (
    <Stack gap="md">
      <PageHeader
        title={mode === "assign" ? "Assign Task" : scope === "team" ? "Team Tasks" : "Tasks"}
        description={
          mode === "assign"
            ? "Review workload and assign tasks manually to available team members."
            : scope === "team"
              ? "Track task execution for employees within your manager scope."
              : "Create, assign, and monitor tasks across projects and departments."
        }
        actions={
          canCreate && mode !== "assign" ? (
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              {tx("New task")}
            </Button>
          ) : null
        }
      />

      {mode === "assign" ? (
        <DataTable<EmployeeWorkload>
          data={workloadQuery.data ?? []}
          loading={workloadQuery.isLoading}
          error={workloadQuery.error ? getApiErrorMessage(workloadQuery.error) : null}
          columns={[
            {
              key: "employee",
              label: "Employee",
              render: (item) => (
                <Stack gap={0}>
                  <Text fw={700}>{item.employee.fullName}</Text>
                  <Text size="xs" c="dimmed">
                    {item.employee.employeeCode}
                  </Text>
                </Stack>
              )
            },
            { key: "active", label: "Active tasks", render: (item) => item.workload.activeTaskCount },
            { key: "estimated", label: "Estimated hours", render: (item) => item.workload.totalEstimatedHours },
            { key: "available", label: "Available hours", render: (item) => item.workload.availableHours },
            { key: "overdue", label: "Overdue", render: (item) => item.workload.overdueTaskCount },
            {
              key: "score",
              label: "Workload score",
              render: (item) => (
                <Stack gap={4}>
                  <Progress value={item.workload.workloadScore} color={workloadColor(item.workload.workloadScore)} />
                  <Text size="xs" c="dimmed">
                    {item.workload.workloadScore}/100
                  </Text>
                </Stack>
              )
            }
          ]}
        />
      ) : null}

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }}>
          <TextInput
            label={tx("Search")}
            placeholder={tx("Search by title")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Status")}
            data={taskStatuses.map((value) => ({ value, label: te(value) }))}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            clearable
          />
          <Select
            label={tx("Priority")}
            data={taskPriorities.map((value) => ({ value, label: te(value) }))}
            value={priority}
            onChange={(value) => {
              setPriority(value);
              setPage(1);
            }}
            clearable
          />
          <Select
            label={tx("Project")}
            data={projectOptions}
            value={projectId}
            onChange={(value) => {
              setProjectId(value);
              setPage(1);
            }}
            clearable
            searchable
          />
          <Select
            label={tx("Team")}
            data={filterTeamOptions}
            value={teamId}
            onChange={(value) => {
              setTeamId(value);
              setPage(1);
            }}
            clearable
            searchable
          />
          <Select
            label={tx("Assignee")}
            data={employeeOptions}
            value={assigneeId}
            onChange={(value) => {
              setAssigneeId(value);
              setPage(1);
            }}
            clearable
            searchable
          />
        </SimpleGrid>
      </Paper>

      <DataTable<Task>
        data={tasksQuery.data?.items ?? []}
        loading={tasksQuery.isLoading}
        error={tasksQuery.error ? getApiErrorMessage(tasksQuery.error) : null}
        total={tasksQuery.data?.meta.total}
        limit={tasksQuery.data?.meta.limit}
        page={tasksQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "task",
            label: "Task",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.title}</Text>
                <Text size="xs" c="dimmed">
                  {item.project?.code ?? tx("No project")}
                </Text>
              </Stack>
            )
          },
          {
            key: "priority",
            label: "Priority",
            render: (item) => (
              <Badge color={priorityColor(item.priority)}>{te(item.priority)}</Badge>
            )
          },
          {
            key: "status",
            label: "Status",
            render: (item) =>
              canUpdateStatus ? (
                <Select
                  data={taskStatuses.map((value) => ({ value, label: te(value) }))}
                  value={item.status}
                  onChange={(value) =>
                    value
                      ? statusMutation.mutate({ id: item.id, status: value as TaskStatus })
                      : undefined
                  }
                  allowDeselect={false}
                  size="xs"
                  w={160}
                />
              ) : (
                <Badge color={statusColor(item.status)}>{te(item.status)}</Badge>
              )
          },
          {
            key: "assignee",
            label: "Assignee",
            render: (item) =>
              item.assignee ? (
                <Stack gap={0}>
                  <Text fw={700}>{item.assignee.fullName}</Text>
                  <Text size="xs" c="dimmed">
                    {item.assignee.employeeCode}
                  </Text>
                </Stack>
              ) : (
                "-"
              )
          },
          { key: "team", label: "Team", render: (item) => formatTeamName(item.team) },
          { key: "dueDate", label: "Due date", render: (item) => formatDate(item.dueDate) },
          { key: "hours", label: "Estimated hours", render: (item) => Number(item.estimatedHours ?? 0) },
          {
            key: "skills",
            label: "Required skills",
            render: (item) =>
              item.requiredSkills?.length ? (
                <Group gap={4}>
                  {item.requiredSkills.slice(0, 3).map((skill) => (
                    <Badge key={skill.id} variant="light">
                      {skill.skill.code}
                    </Badge>
                  ))}
                  {item.requiredSkills.length > 3 ? (
                    <Badge variant="outline">+{item.requiredSkills.length - 3}</Badge>
                  ) : null}
                </Group>
              ) : (
                "-"
              )
          },
          {
            key: "actions",
            label: "",
            width: 132,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                {canUpdate && mode !== "assign" ? (
                  <Tooltip label={tx("Edit")}>
                    <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                      <Edit size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
                {canAssign ? (
                  <Tooltip label={tx("Assign")}>
                    <ActionIcon variant="subtle" color="teal" onClick={() => openAssign(item)}>
                      <UserPlus size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
                <Tooltip label={tx("Assignment history")}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => setHistoryTask(item)}>
                    <History size={16} />
                  </ActionIcon>
                </Tooltip>
                {canDelete && mode !== "assign" ? (
                  <Tooltip label={tx("Delete")}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        openConfirmModal({
                          title: tx("Delete task"),
                          message: `${tx("Delete")} ${item.title}?`,
                          confirmLabel: tx("Delete"),
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
        title={editing ? tx("Edit task") : tx("New task")}
        size="xl"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Title")} required {...form.getInputProps("title")} />
            <Textarea
              label={tx("Description")}
              autosize
              minRows={3}
              {...form.getInputProps("description")}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label={tx("Project")}
                data={projectOptions}
                clearable
                searchable
                value={form.values.projectId || null}
                onChange={handleProjectChange}
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
                label={tx("Priority")}
                data={taskPriorities.map((value) => ({ value, label: te(value) }))}
                allowDeselect={false}
                {...form.getInputProps("priority")}
              />
              <Select
                label={tx("Status")}
                data={taskStatuses.map((value) => ({ value, label: te(value) }))}
                allowDeselect={false}
                {...form.getInputProps("status")}
              />
              <Select
                label={tx("Assignee")}
                data={formEmployeeOptions}
                clearable
                searchable
                {...form.getInputProps("assigneeId")}
              />
              <TextInput label={tx("Start date")} type="date" {...form.getInputProps("startDate")} />
              <TextInput label={tx("Due date")} type="date" {...form.getInputProps("dueDate")} />
              <NumberInput
                label={tx("Estimated hours")}
                min={0}
                decimalScale={1}
                {...form.getInputProps("estimatedHours")}
              />
              <NumberInput
                label={tx("Actual hours")}
                min={0}
                decimalScale={1}
                {...form.getInputProps("actualHours")}
              />
            </SimpleGrid>

            <Divider label={tx("Required skills")} labelPosition="left" />
            <Stack gap="sm">
              {form.values.requiredSkills.map((skill, index) => (
                <Paper key={index} withBorder radius="md" p="sm">
                  <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
                    <Select
                      label={tx("Skill")}
                      data={skillOptions}
                      searchable
                      required
                      {...form.getInputProps(`requiredSkills.${index}.skillId`)}
                    />
                    <Select
                      label={tx("Required proficiency")}
                      data={proficiencyOptions.map((value) => ({ value, label: te(value) }))}
                      clearable
                      {...form.getInputProps(`requiredSkills.${index}.requiredProficiency`)}
                    />
                    <NumberInput
                      label={tx("Weight")}
                      min={0.1}
                      decimalScale={1}
                      {...form.getInputProps(`requiredSkills.${index}.weight`)}
                    />
                    <Group align="flex-end" justify="space-between" wrap="nowrap">
                      <Switch
                        label={tx("Required")}
                        {...form.getInputProps(`requiredSkills.${index}.isRequired`, {
                          type: "checkbox"
                        })}
                      />
                      <Tooltip label={tx("Delete")}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => form.removeListItem("requiredSkills", index)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </SimpleGrid>
                </Paper>
              ))}
              <Button
                variant="light"
                leftSection={<Plus size={16} />}
                onClick={() => form.insertListItem("requiredSkills", defaultRequiredSkill())}
              >
                {tx("Add required skill")}
              </Button>
            </Stack>

            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title={tx("Assign task")}
      >
        <form onSubmit={assignForm.onSubmit((values) => assignMutation.mutate(values))}>
          <Stack>
            <Text fw={700}>{assigning?.title}</Text>
            <Select
              label={tx("Assignee")}
              data={assignEmployeeOptions}
              searchable
              required
              {...assignForm.getInputProps("assigneeId")}
            />
            <Textarea label={tx("Note")} autosize minRows={3} {...assignForm.getInputProps("note")} />
            <Button type="submit" loading={assignMutation.isPending}>
              {tx("Assign")}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(historyTask)}
        onClose={() => setHistoryTask(null)}
        title={tx("Assignment history")}
        size="lg"
      >
        <DataTable<TaskAssignment>
          data={assignmentsQuery.data?.items ?? []}
          loading={assignmentsQuery.isLoading}
          error={assignmentsQuery.error ? getApiErrorMessage(assignmentsQuery.error) : null}
          columns={[
            {
              key: "assignee",
              label: "Assignee",
              render: (item) => (
                <Stack gap={0}>
                  <Text fw={700}>{item.assignee.fullName}</Text>
                  <Text size="xs" c="dimmed">
                    {item.assignee.employeeCode}
                  </Text>
                </Stack>
              )
            },
            {
              key: "type",
              label: "Type",
              render: (item) => <Badge>{te(item.assignmentType)}</Badge>
            },
            { key: "by", label: "Assigned by", render: (item) => item.assignedByUser?.username ?? "-" },
            { key: "time", label: "Time", render: (item) => formatDateTime(item.assignedAt) },
            { key: "note", label: "Note", render: (item) => item.note ?? "-" }
          ]}
        />
      </Modal>
    </Stack>
  );
}

function defaultRequiredSkill(): RequiredSkillForm {
  return {
    skillId: "",
    requiredProficiency: "",
    weight: 1,
    isRequired: true
  };
}

function normalizeTaskPayload(values: {
  title: string;
  description: string;
  projectId: string;
  departmentId: string;
  teamId: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  startDate: string;
  dueDate: string;
  estimatedHours: number | string;
  actualHours: number | string;
  requiredSkills: RequiredSkillForm[];
}) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    projectId: values.projectId ? Number(values.projectId) : undefined,
    departmentId: values.departmentId ? Number(values.departmentId) : undefined,
    teamId: values.teamId ? Number(values.teamId) : undefined,
    priority: values.priority,
    status: values.status,
    assigneeId: values.assigneeId ? Number(values.assigneeId) : undefined,
    startDate: values.startDate || undefined,
    dueDate: values.dueDate || undefined,
    estimatedHours:
      values.estimatedHours === "" ? undefined : Number(values.estimatedHours),
    actualHours: values.actualHours === "" ? undefined : Number(values.actualHours),
    requiredSkills: values.requiredSkills
      .filter((item) => item.skillId)
      .map((item) => ({
        skillId: Number(item.skillId),
        requiredProficiency: item.requiredProficiency || undefined,
        weight: item.weight === "" ? 1 : Number(item.weight),
        isRequired: item.isRequired
      }))
  };
}

function priorityColor(priority: TaskPriority) {
  switch (priority) {
    case "URGENT":
      return "red";
    case "HIGH":
      return "orange";
    case "MEDIUM":
      return "blue";
    default:
      return "gray";
  }
}

function workloadColor(score: number) {
  if (score >= 80) {
    return "green";
  }
  if (score >= 50) {
    return "yellow";
  }
  return "red";
}

function employeeAllowedForTeam(employeeId: string, teamId: string, teams: Team[]) {
  if (!teamId) {
    return true;
  }
  if (!employeeId) {
    return false;
  }
  const team = teams.find((item) => String(item.id) === teamId);
  if (!team) {
    return false;
  }
  const allowedIds = new Set([
    ...(team.leadId ? [team.leadId] : []),
    ...(team.members?.map((member) => member.employeeId) ?? [])
  ].map(String));
  return allowedIds.has(employeeId);
}
