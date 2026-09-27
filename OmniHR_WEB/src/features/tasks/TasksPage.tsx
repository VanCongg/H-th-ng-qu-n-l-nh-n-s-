import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Divider,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Columns3,
  Edit,
  Eye,
  History,
  ListPlus,
  ListTree,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { currentMonthRange, teamTaskProjects } from "./teamTaskAccess";
import { buildProjectSections, localDateKey, type TaskTreeRow } from "./taskBoard";
import { TaskKanbanView, TaskTreeView, type BoardHandlers, type TaskAction } from "./TaskBoardViews";
import {
  aiTaskSuggestionsApi,
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
  formatTeamName,
  statusColor
} from "../../api/format";
import type {
  AiTaskSuggestion,
  AiTaskSuggestionItem,
  CareerLevel,
  EmployeeWorkload,
  SkillProficiency,
  Task,
  TaskAssignment,
  TaskPriority,
  TaskQuickFilter,
  TaskSkillImportance,
  TaskStatus,
  Team
} from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TEAM_TASKS_PER_PAGE = 10;
/** The current status plus the moves the API allows the viewer to make. */
function statusChoices(task: Pick<Task, "status" | "allowedStatuses">): TaskStatus[] {
  if (!task.allowedStatuses) {
    return taskStatuses;
  }
  return taskStatuses.filter(
    (status) => status === task.status || task.allowedStatuses?.includes(status)
  );
}

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
const skillImportanceOptions: TaskSkillImportance[] = [
  "REQUIRED",
  "IMPORTANT",
  "NICE_TO_HAVE"
];

type RequiredSkillForm = {
  skillId: string;
  requiredProficiency: SkillProficiency | "";
  importance: TaskSkillImportance | "";
};

type TasksPageProps = {
  scope: "all" | "team";
  mode?: "manage" | "assign";
};

export function TasksPage({ scope, mode = "manage" }: TasksPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentForSubtask, setParentForSubtask] = useState<Task | null>(null);
  const [assigning, setAssigning] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskTreeRow | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiTaskSuggestion | null>(null);
  const [selectedAiItemId, setSelectedAiItemId] = useState<number | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  // Team tasks the user opened or closed by hand, against the default: closed,
  // or open while a filter picks out subtasks.
  const [toggledTaskIds, setToggledTaskIds] = useState<Set<number>>(() => new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [quick, setQuick] = useState<TaskQuickFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [boardView, setBoardView] = useState<"tree" | "kanban">("tree");
  const [page, setPage] = useState(1);
  const today = useMemo(() => localDateKey(), []);
  // The team board defaults to what still needs attention: due this month, or
  // unfinished from any month. "all" brings back finished work from the past.
  const [teamView, setTeamView] = useState<"active" | "all">("active");
  const monthRange = useMemo(() => currentMonthRange(), []);
  const activeTeamView = scope === "team" && teamView === "active";

  const canCreate = hasPermission("TASK_CREATE");
  const canUpdate = hasPermission("TASK_UPDATE");
  const canDelete = hasPermission("TASK_DELETE");
  const canAssign = hasPermission("TASK_ASSIGN");
  const canUpdateStatus = hasPermission("TASK_UPDATE_STATUS");
  const canGenerateAi = hasPermission("AI_TASK_SUGGEST");
  const canSelectAi = hasPermission("AI_TASK_SELECT");

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      scope,
      search,
      status,
      priority,
      projectId,
      teamId,
      assigneeId,
      quick,
      page,
      activeTeamView
    ],
    queryFn: () => {
      const params = {
        ...(activeTeamView
          ? { ...monthRange, includeOpen: true }
          : {}),
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        projectId: projectId ? Number(projectId) : undefined,
        teamId: teamId ? Number(teamId) : undefined,
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        quick: quick || undefined,
        page,
        // Team tasks per page; each brings its subtasks along.
        limit: TEAM_TASKS_PER_PAGE
      };
      return scope === "team" ? tasksApi.teamGrouped(params) : tasksApi.listGrouped(params);
    }
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", scope, "task-options"],
    queryFn: () => projectsApi.list({ limit: 100 })
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
      technologies: [] as string[],
      parentTaskId: "",
      projectId: "",
      teamId: "",
      priority: "MEDIUM" as TaskPriority,
      minLevel: "" as CareerLevel | "",
      maxLevel: "" as CareerLevel | "",
      status: "TODO" as TaskStatus,
      assigneeId: "",
      startDate: "",
      dueDate: "",
      estimatedHours: "" as number | string,
      actualHours: 0,
      requiredSkills: [] as RequiredSkillForm[]
    },
    validate: {
      title: (value) => (value.trim() ? null : tx("Required")),
      projectId: (value, values) =>
        values.parentTaskId || value ? null : tx("Required"),
      teamId: (value, values) =>
        values.parentTaskId || value ? null : tx("Required")
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
      const payload: Record<string, unknown> = normalizeTaskPayload(values);
      if (values.parentTaskId) {
        delete payload.technologies;
        delete payload.assigneeId;
        if (!editing) {
          delete payload.actualHours;
        }
      } else {
        delete payload.requiredSkills;
        delete payload.actualHours;
        delete payload.assigneeId;
      }
      if (!editing) {
        return tasksApi.create(payload);
      }
      delete payload.parentTaskId;
      delete payload.projectId;
      delete payload.teamId;
      return tasksApi.update(editing.id, payload);
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
  const assignMutation = useMutation<Task | AiTaskSuggestion, unknown, typeof assignForm.values>({
    mutationFn: (values: typeof assignForm.values) => {
      if (!assigning) {
        throw new Error(tx("Task is required"));
      }
      const selectedAiItem = aiSuggestion?.items.find(
        (item) => item.suggestionItemId === selectedAiItemId
      );
      if (
        canSelectAi &&
        aiSuggestion &&
        selectedAiItem &&
        String(selectedAiItem.employeeId) === values.assigneeId
      ) {
        return aiTaskSuggestionsApi.select(aiSuggestion.id, {
          suggestionItemId: selectedAiItem.suggestionItemId,
          note: values.note.trim() || "Selected from task assignment"
        });
      }
      return tasksApi.assign(assigning.id, {
        assigneeId: Number(values.assigneeId),
        note: values.note.trim() || undefined
      });
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Task assigned") });
      queryClient.invalidateQueries({ queryKey: ["ai-task-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
      closeAssign();
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const generateAiMutation = useMutation({
    mutationFn: () => {
      if (!assigning) {
        throw new Error(tx("Task is required"));
      }
      return aiTaskSuggestionsApi.generate(assigning.id, {
        limit: 5,
        includeAvailability: true,
        includePendingLeave: true,
        includeSelf: false
      });
    },
    onSuccess: (result) => {
      notifications.show({ color: "green", message: tx("AI suggestion generated") });
      setAiSuggestion(result);
      setSelectedAiItemId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-task-suggestions"] });
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
    setParentForSubtask(null);
    form.setValues({
      title: "",
      description: "",
      technologies: [],
      parentTaskId: "",
      projectId: "",
      teamId: "",
      priority: "MEDIUM",
      minLevel: "",
      maxLevel: "",
      status: "TODO",
      assigneeId: "",
      startDate: "",
      dueDate: "",
      estimatedHours: "",
      actualHours: 0,
      requiredSkills: []
    });
    setOpened(true);
  }

  function openEdit(item: Task) {
    setEditing(item);
    setParentForSubtask(item.parentTask ?? null);
    form.setValues({
      title: item.title,
      description: item.description ?? "",
      technologies: item.technologies ?? [],
      parentTaskId: item.parentTaskId ? String(item.parentTaskId) : "",
      projectId: item.projectId ? String(item.projectId) : "",
      teamId: item.teamId ? String(item.teamId) : "",
      priority: item.priority,
      minLevel: item.minLevel ?? "",
      maxLevel: item.maxLevel ?? "",
      status: item.status,
      assigneeId: item.assigneeId ? String(item.assigneeId) : "",
      startDate: item.startDate?.slice(0, 10) ?? "",
      dueDate: item.dueDate?.slice(0, 10) ?? "",
      estimatedHours:
        item.estimatedHours === null || item.estimatedHours === undefined
          ? ""
          : Number(item.estimatedHours),
      actualHours: Number(item.actualHours ?? 0),
      requiredSkills:
        item.requiredSkills?.map((skill) => ({
          skillId: String(skill.skillId),
          requiredProficiency: skill.requiredProficiency,
          importance: skill.importance
        })) ?? []
    });
    setOpened(true);
  }

  function openCreateSubtask(parent: Task) {
    setEditing(null);
    setParentForSubtask(parent);
    form.setValues({
      title: "",
      description: "",
      technologies: [],
      parentTaskId: String(parent.id),
      projectId: parent.projectId ? String(parent.projectId) : "",
      teamId: parent.teamId ? String(parent.teamId) : "",
      priority: parent.priority,
      // Empty: the subtask takes the team task's range.
      minLevel: "",
      maxLevel: "",
      status: "TODO",
      assigneeId: "",
      startDate: parent.startDate?.slice(0, 10) ?? "",
      dueDate: parent.dueDate?.slice(0, 10) ?? "",
      estimatedHours: 4,
      actualHours: 0,
      requiredSkills: []
    });
    setOpened(true);
  }

  function openAssign(item: Task) {
    setAssigning(item);
    setAiSuggestion(null);
    setSelectedAiItemId(null);
    assignForm.setValues({
      assigneeId: item.assigneeId ? String(item.assigneeId) : "",
      note: ""
    });
  }

  function closeAssign() {
    setAssigning(null);
    setAiSuggestion(null);
    setSelectedAiItemId(null);
  }

  function handleAssignAssigneeChange(value: string | null) {
    const nextValue = value ?? "";
    assignForm.setFieldValue("assigneeId", nextValue);
    const selectedAiItem = aiSuggestion?.items.find(
      (item) => item.suggestionItemId === selectedAiItemId
    );
    if (!selectedAiItem || String(selectedAiItem.employeeId) !== nextValue) {
      setSelectedAiItemId(null);
    }
  }

  function applyAiCandidate(item: AiTaskSuggestionItem) {
    assignForm.setFieldValue("assigneeId", String(item.employeeId));
    setSelectedAiItemId(item.suggestionItemId);
  }

  const projectOptions = (projectsQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} - ${item.name}`
  }));
  const teamItems = teamsQuery.data?.items ?? [];
  const selectedProject = projectsQuery.data?.items.find(
    (item) => String(item.id) === form.values.projectId
  );
  const teamOptions = teamItems
    .filter(
      (item) =>
        item.isActive &&
        (!selectedProject?.departmentId || item.departmentId === selectedProject.departmentId)
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
      ? ` - ${workload.availableHours}h ${tx("available")}, ${workload.activeTaskCount} ${tx("active")}`
      : "";
    return {
      value: String(item.id),
      label: `${item.fullName} (${item.employeeCode})${suffix}`
    };
  });
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
    const currentTeam = teamItems.find((item) => String(item.id) === form.values.teamId);
    if (!project || !currentTeam || currentTeam.departmentId !== project.departmentId) {
      form.setFieldValue("teamId", "");
      form.setFieldValue("assigneeId", "");
    }
  }

  function handleTeamChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("teamId", nextValue);
    if (!employeeAllowedForTeam(form.values.assigneeId, nextValue, teamItems)) {
      form.setFieldValue("assigneeId", "");
    }
  }

  function toggleTask(taskId: number) {
    setToggledTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleProject(key: string) {
    setCollapsedProjects((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /** Filters that pick out subtasks; project and team pick whole team tasks. */
  const narrowing = Boolean(search || status || priority || assigneeId || quick);
  const advancedFilterCount = [status, priority, projectId, teamId, assigneeId].filter(Boolean).length;
  const sections = useMemo(
    () => buildProjectSections(tasksQuery.data?.items ?? [], narrowing),
    [narrowing, tasksQuery.data?.items]
  );
  const summary = tasksQuery.data?.summary;

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
      setToggledTaskIds(new Set());
    };
  }

  function clearFilters() {
    setSearch("");
    setStatus(null);
    setPriority(null);
    setProjectId(null);
    setTeamId(null);
    setAssigneeId(null);
    setQuick(null);
    setPage(1);
    setToggledTaskIds(new Set());
  }

  function actionsFor(item: TaskTreeRow): TaskAction[] {
    const canManageItem =
      user?.roles.includes("ADMIN") ||
      item.project?.managerId === user?.employeeId ||
      (Boolean(item.parentTaskId) && item.team?.leadId === user?.employeeId);
    const canSplitItem =
      user?.roles.includes("ADMIN") ||
      item.project?.managerId === user?.employeeId ||
      item.team?.leadId === user?.employeeId;
    const actions: TaskAction[] = [
      { key: "view", label: tx("View details"), icon: <Eye size={16} />, onClick: () => setViewingTask(item) }
    ];
    if (canCreate && !item.parentTaskId && canSplitItem && mode !== "assign") {
      actions.push({
        key: "subtask",
        label: tx("Create subtask"),
        icon: <ListPlus size={16} />,
        onClick: () => openCreateSubtask(item)
      });
    }
    if (canUpdate && canManageItem && mode !== "assign") {
      actions.push({ key: "edit", label: tx("Edit"), icon: <Edit size={16} />, onClick: () => openEdit(item) });
    }
    if (canAssign && item.parentTaskId && canManageItem) {
      actions.push({
        key: "assign",
        label: tx(item.assigneeId ? "Reassign" : "Assign"),
        icon: <UserPlus size={16} />,
        onClick: () => openAssign(item)
      });
    }
    if (item.parentTaskId) {
      actions.push({
        key: "history",
        label: tx("Assignment history"),
        icon: <History size={16} />,
        onClick: () => setHistoryTask(item)
      });
    }
    if (canDelete && canManageItem && mode !== "assign") {
      actions.push({
        key: "delete",
        label: tx("Delete"),
        icon: <Trash2 size={16} />,
        color: "red",
        onClick: () =>
          openConfirmModal({
            title: tx("Delete task"),
            message: `${tx("Delete")} ${item.title}?`,
            confirmLabel: tx("Delete"),
            onConfirm: () => deleteMutation.mutate(item.id)
          })
      });
    }
    return actions;
  }

  const boardHandlers: BoardHandlers = {
    today,
    onView: setViewingTask,
    actionsFor,
    statusChoicesFor: (item) => (canUpdateStatus && item.parentTaskId ? statusChoices(item) : []),
    onStatusChange: (item, next) => statusMutation.mutate({ id: item.id, status: next }),
    assignFor: (item) => {
      const canManageItem =
        user?.roles.includes("ADMIN") ||
        item.project?.managerId === user?.employeeId ||
        item.team?.leadId === user?.employeeId;
      return canAssign && item.parentTaskId && canManageItem ? () => openAssign(item) : null;
    }
  };

  const quickFilters: Array<{ value: TaskQuickFilter; label: string; color: string; icon: ReactNode }> = [
    { value: "overdue", label: tx("Overdue"), color: "red", icon: <AlertTriangle size={14} /> },
    { value: "dueSoon", label: tx("Due soon"), color: "orange", icon: <Clock size={14} /> },
    { value: "review", label: tx("Waiting for my review"), color: "yellow", icon: <UserCheck size={14} /> },
    { value: "unassigned", label: tx("Unassigned"), color: "grape", icon: <UserPlus size={14} /> }
  ];
  const totalTeamTasks = tasksQuery.data?.meta.total ?? 0;

  const isSubtaskForm = Boolean(form.values.parentTaskId);
  const levelRangeError =
    form.values.minLevel &&
    form.values.maxLevel &&
    careerLevels.indexOf(form.values.minLevel) > careerLevels.indexOf(form.values.maxLevel)
      ? tx("The lowest level is above the highest")
      : null;
  const creatableProjects = teamTaskProjects(projectsQuery.data?.items ?? [], user);
  const canCreateTeamTask = canCreate && creatableProjects.length > 0;
  // A new team task may only target a department the user heads; editing
  // and subtasks keep the full list so their fixed project still renders.
  const formProjectOptions =
    editing || isSubtaskForm
      ? projectOptions
      : creatableProjects.map((item) => ({
          value: String(item.id),
          label: `${item.code} - ${item.name}`
        }));

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
          canCreateTeamTask && mode !== "assign" ? (
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              {tx("New team task")}
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
            { key: "remaining", label: "Hours left", render: (item) => `${item.workload.totalEstimatedHours}h` },
            { key: "week", label: "This week", render: (item) => `${item.workload.weeklyLoadHours}h / ${item.workload.capacityHoursPerWeek}h` },
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

      <Paper withBorder radius="md" p="sm" className="filter-bar">
        <Stack gap="sm">
          <Group justify="space-between" gap="sm">
            <Group gap="sm">
              {scope === "team" ? (
                <SegmentedControl
                  size="xs"
                  value={teamView}
                  onChange={(value) => resetPage(setTeamView)(value as "active" | "all")}
                  data={[
                    { value: "active", label: tx("This month & unfinished") },
                    { value: "all", label: tx("All tasks") }
                  ]}
                />
              ) : null}
              <TextInput
                size="xs"
                w={240}
                leftSection={<Search size={14} />}
                placeholder={tx("Search by title")}
                value={search}
                onChange={(event) => resetPage(setSearch)(event.currentTarget.value)}
              />
              <Button
                size="xs"
                variant={filtersOpen || advancedFilterCount ? "light" : "default"}
                leftSection={<SlidersHorizontal size={14} />}
                rightSection={
                  advancedFilterCount ? (
                    <Badge size="xs" circle>
                      {advancedFilterCount}
                    </Badge>
                  ) : null
                }
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {tx("Filters")}
              </Button>
              {narrowing || advancedFilterCount ? (
                <Button size="xs" variant="subtle" color="gray" onClick={clearFilters}>
                  {tx("Clear filters")}
                </Button>
              ) : null}
            </Group>
            <SegmentedControl
              size="xs"
              value={boardView}
              onChange={(value) => setBoardView(value as "tree" | "kanban")}
              data={[
                {
                  value: "tree",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <ListTree size={14} />
                      {tx("By project")}
                    </Group>
                  )
                },
                {
                  value: "kanban",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <Columns3 size={14} />
                      Kanban
                    </Group>
                  )
                }
              ]}
            />
          </Group>

          <Group gap="xs">
            {quickFilters.map((item) => {
              const active = quick === item.value;
              const count = summary?.[item.value];
              return (
                <Button
                  key={item.value}
                  size="compact-sm"
                  radius="xl"
                  color={item.color}
                  variant={active ? "filled" : "light"}
                  leftSection={item.icon}
                  rightSection={
                    count === undefined ? null : (
                      <Badge size="sm" px={6} variant={active ? "white" : "filled"} color={item.color}>
                        {count}
                      </Badge>
                    )
                  }
                  onClick={() => resetPage(setQuick)(active ? null : item.value)}
                >
                  {item.label}
                </Button>
              );
            })}
          </Group>

          <Collapse in={filtersOpen}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
              <Select
                size="xs"
                label={tx("Status")}
                placeholder={tx("All statuses")}
                data={taskStatuses.map((value) => ({ value, label: te(value) }))}
                value={status}
                onChange={resetPage(setStatus)}
                clearable
              />
              <Select
                size="xs"
                label={tx("Priority")}
                placeholder={tx("All priorities")}
                data={taskPriorities.map((value) => ({ value, label: te(value) }))}
                value={priority}
                onChange={resetPage(setPriority)}
                clearable
              />
              <Select
                size="xs"
                label={tx("Project")}
                placeholder={tx("All projects")}
                data={projectOptions}
                value={projectId}
                onChange={resetPage(setProjectId)}
                clearable
                searchable
              />
              <Select
                size="xs"
                label={tx("Team")}
                placeholder={tx("All teams")}
                data={filterTeamOptions}
                value={teamId}
                onChange={resetPage(setTeamId)}
                clearable
                searchable
              />
              <Select
                size="xs"
                label={tx("Assignee")}
                placeholder={tx("All assignees")}
                data={employeeOptions}
                value={assigneeId}
                onChange={resetPage(setAssigneeId)}
                clearable
                searchable
              />
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Paper>

      {tasksQuery.error ? (
        <DataTable data={[]} columns={[]} error={getApiErrorMessage(tasksQuery.error)} />
      ) : tasksQuery.isLoading ? (
        <DataTable data={[]} columns={[{ key: "task", label: "Task", render: () => null }]} loading />
      ) : !sections.length ? (
        <DataTable
          data={[]}
          columns={[{ key: "task", label: "Task", render: () => null }]}
          emptyTitle={narrowing || advancedFilterCount ? tx("No task matches these filters") : undefined}
        />
      ) : boardView === "tree" ? (
        <TaskTreeView
          {...boardHandlers}
          sections={sections}
          filtered={narrowing}
          toggledTaskIds={toggledTaskIds}
          onToggleTask={toggleTask}
          collapsedProjects={collapsedProjects}
          onToggleProject={toggleProject}
        />
      ) : (
        <TaskKanbanView {...boardHandlers} sections={sections} />
      )}

      {totalTeamTasks ? (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {boardView === "kanban"
              ? tx("Kanban shows the subtasks of the team tasks on this page")
              : `${totalTeamTasks} ${tx("team tasks")}`}
          </Text>
          {totalTeamTasks > TEAM_TASKS_PER_PAGE ? (
            <Pagination
              size="sm"
              total={Math.ceil(totalTeamTasks / TEAM_TASKS_PER_PAGE)}
              value={page}
              onChange={(value) => {
                setPage(value);
                setToggledTaskIds(new Set());
              }}
            />
          ) : null}
        </Group>
      ) : null}

      <Modal
        opened={Boolean(viewingTask)}
        onClose={() => setViewingTask(null)}
        title={viewingTask?.parentTaskId ? tx("Subtask details") : tx("Task details")}
        size="lg"
      >
        {viewingTask ? (
          <Stack>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2} style={{ flex: 1 }}>
                <Group gap="xs">
                  <Badge size="xs" variant={viewingTask.parentTaskId ? "light" : "filled"}>
                    {tx(viewingTask.parentTaskId ? "Subtask" : "Team task")}
                  </Badge>
                  <Text fw={800} size="lg">
                    {viewingTask.title}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {viewingTask.parentTask?.title || viewingTask.rowParent?.title
                    ? `${viewingTask.project?.code ?? tx("No project")} · ${
                        viewingTask.parentTask?.title ?? viewingTask.rowParent?.title
                      }`
                    : viewingTask.project?.code ?? tx("No project")}
                </Text>
              </Stack>
              <Group gap={6} justify="flex-end">
                <Badge color={priorityColor(viewingTask.priority)}>
                  {te(viewingTask.priority)}
                </Badge>
                <Badge color={statusColor(viewingTask.status)}>
                  {te(viewingTask.status)}
                </Badge>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DetailItem
                label={tx("Project")}
                value={viewingTask.project?.name ?? "-"}
              />
              <DetailItem label={tx("Team")} value={formatTeamName(viewingTask.team)} />
              <DetailItem
                label={tx("Assignee")}
                value={
                  viewingTask.assignee
                    ? `${viewingTask.assignee.fullName} (${viewingTask.assignee.employeeCode})`
                    : viewingTask.parentTaskId
                      ? "-"
                      : tx("Team responsibility")
                }
              />
              <DetailItem
                label={tx("Parent task")}
                value={viewingTask.parentTask?.title ?? viewingTask.rowParent?.title ?? "-"}
              />
              <DetailItem label={tx("Start date")} value={formatDate(viewingTask.startDate)} />
              <DetailItem label={tx("Due date")} value={formatDate(viewingTask.dueDate)} />
              <DetailItem label={tx("Hours")} value={formatTaskHours(viewingTask)} />
              <DetailItem label={tx("Suitable level")} value={formatLevelRange(viewingTask, te, tx)} />
              <DetailItem
                label={tx("Subtasks")}
                value={viewingTask.parentTaskId ? "-" : taskChildCount(viewingTask)}
              />
            </SimpleGrid>

            <Divider label={tx("Description")} labelPosition="left" />
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {viewingTask.description || "-"}
            </Text>

            {!viewingTask.parentTaskId ? (
              <>
                <Divider label={tx("Technologies")} labelPosition="left" />
                {viewingTask.technologies?.length ? (
                  <Group gap={6}>
                    {viewingTask.technologies.map((technology) => (
                      <Badge key={technology} variant="light" color="cyan">
                        {technology}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                )}
              </>
            ) : (
              <>
                <Divider label={tx("Required skills")} labelPosition="left" />
                {viewingTask.requiredSkills?.length ? (
                  <Stack gap="xs">
                    {viewingTask.requiredSkills.map((skill) => (
                      <Paper key={skill.id} withBorder radius="md" p="sm">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={0}>
                            <Text fw={700}>
                              {skill.skill.code} - {skill.skill.name}
                            </Text>
                          </Stack>
                          <Group gap={6}>
                            <Badge variant="light">
                              {te(skill.requiredProficiency)}
                            </Badge>
                            <Badge
                              variant="light"
                              color={skillImportanceColor(skill.importance)}
                            >
                              {te(skill.importance)}
                            </Badge>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                )}
              </>
            )}
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setParentForSubtask(null);
        }}
        title={
          editing
            ? tx("Edit task")
            : parentForSubtask
              ? tx("Create subtask")
              : tx("New team task")
        }
        size="xl"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            {parentForSubtask ? (
              <Paper withBorder radius="md" p="sm" bg="indigo.0">
                <Text size="xs" c="dimmed">{tx("Parent task")}</Text>
                <Text fw={700}>{parentForSubtask.title}</Text>
                <Text size="xs" c="dimmed">
                  {formatTeamName(parentForSubtask.team)} · {parentForSubtask.project?.name}
                </Text>
              </Paper>
            ) : null}
            <TextInput label={tx("Title")} required {...form.getInputProps("title")} />
            <Textarea
              label={tx("Description")}
              autosize
              minRows={3}
              {...form.getInputProps("description")}
            />
            {!isSubtaskForm ? (
              <TagsInput
                label={tx("Technologies")}
                description={tx("Enter a technology and press Enter")}
                placeholder={tx("Example: NestJS, React, PostgreSQL")}
                maxTags={30}
                splitChars={[","]}
                {...form.getInputProps("technologies")}
              />
            ) : null}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label={tx("Project")}
                data={formProjectOptions}
                clearable
                searchable
                required={!isSubtaskForm}
                disabled={Boolean(editing) || isSubtaskForm}
                value={form.values.projectId || null}
                onChange={handleProjectChange}
                error={form.errors.projectId}
              />
              <Select
                label={tx("Team")}
                data={teamOptions}
                clearable={!isSubtaskForm}
                searchable
                required={!isSubtaskForm}
                disabled={Boolean(editing) || isSubtaskForm || !form.values.projectId}
                value={form.values.teamId || null}
                onChange={handleTeamChange}
                error={form.errors.teamId}
              />
              <Select
                label={tx("Priority")}
                data={taskPriorities.map((value) => ({ value, label: te(value) }))}
                allowDeselect={false}
                {...form.getInputProps("priority")}
              />
              <Group grow align="flex-start">
                <Select
                  label={tx("Suitable level from")}
                  description={tx(isSubtaskForm ? "Empty: as the team task" : "Empty: any level")}
                  placeholder={tx("Any")}
                  data={careerLevels.map((value) => ({ value, label: te(value) }))}
                  clearable
                  {...form.getInputProps("minLevel")}
                />
                <Select
                  label={tx("to")}
                  placeholder={tx("Any")}
                  data={careerLevels.map((value) => ({ value, label: te(value) }))}
                  clearable
                  error={levelRangeError}
                  {...form.getInputProps("maxLevel")}
                />
              </Group>
              <Select
                label={tx("Status")}
                data={(editing ? statusChoices(editing) : taskStatuses).map((value) => ({
                  value,
                  label: te(value)
                }))}
                allowDeselect={false}
                disabled={!isSubtaskForm}
                {...form.getInputProps("status")}
              />
              {!isSubtaskForm ? (
                <TextInput
                  label={tx("Responsibility")}
                  value={tx("Assigned to the selected team")}
                  readOnly
                />
              ) : null}
              <TextInput label={tx("Start date")} type="date" {...form.getInputProps("startDate")} />
              <TextInput label={tx("Due date")} type="date" {...form.getInputProps("dueDate")} />
              <NumberInput
                label={tx(isSubtaskForm ? "Estimated hours" : "Total estimated hours")}
                placeholder={!isSubtaskForm ? tx("Optional") : undefined}
                min={0}
                decimalScale={1}
                {...form.getInputProps("estimatedHours")}
              />
              {isSubtaskForm && editing ? (
                <NumberInput
                  label={tx("Actual hours")}
                  min={0}
                  decimalScale={1}
                  {...form.getInputProps("actualHours")}
                />
              ) : !isSubtaskForm && editing ? (
                <TextInput
                  label={tx("Actual hours from subtasks")}
                  value={Number(editing.actualHours ?? 0)}
                  readOnly
                />
              ) : null}
            </SimpleGrid>

            {isSubtaskForm ? (
              <>
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
                      required
                      allowDeselect={false}
                      {...form.getInputProps(`requiredSkills.${index}.requiredProficiency`)}
                    />
                    <Select
                      label={tx("Skill role")}
                      data={skillImportanceOptions.map((value) => ({ value, label: te(value) }))}
                      required
                      allowDeselect={false}
                      {...form.getInputProps(`requiredSkills.${index}.importance`)}
                    />
                    <Group align="flex-end" justify="space-between" wrap="nowrap">
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
              </>
            ) : null}

            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(assigning)}
        onClose={closeAssign}
        title={tx("Assign task")}
        size="lg"
      >
        <form onSubmit={assignForm.onSubmit((values) => assignMutation.mutate(values))}>
          <Stack>
            <Group justify="space-between" align="flex-start">
              <Stack gap={0}>
                <Text fw={700}>{assigning?.title}</Text>
                <Text size="xs" c="dimmed">
                  {assigning?.project?.code ?? tx("No project")}
                </Text>
              </Stack>
              {selectedAiItemId ? (
                <Badge color="violet" variant="light">
                  AI
                </Badge>
              ) : null}
            </Group>
            <Group align="flex-end" wrap="nowrap">
              <Select
                label={tx("Assignee")}
                data={assignEmployeeOptions}
                searchable
                required
                value={assignForm.values.assigneeId || null}
                onChange={handleAssignAssigneeChange}
                error={assignForm.errors.assigneeId}
                style={{ flex: 1 }}
              />
              {canGenerateAi ? (
                <Tooltip label={tx("Generate AI suggestions")}>
                  <ActionIcon
                    size={36}
                    variant="light"
                    color="violet"
                    loading={generateAiMutation.isPending}
                    onClick={() => generateAiMutation.mutate()}
                  >
                    <Sparkles size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>

            {aiSuggestion ? (
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <Sparkles size={16} />
                    <Text fw={700}>{tx("AI suggestions")}</Text>
                  </Group>
                  <Group gap={6}>
                    <Badge color={statusColor(aiSuggestion.status)}>
                      {te(aiSuggestion.status)}
                    </Badge>
                  </Group>
                </Group>
                {aiSuggestion.items.map((item) => {
                  const isSelected = selectedAiItemId === item.suggestionItemId;
                  return (
                    <Paper
                      key={item.suggestionItemId}
                      withBorder
                      radius="md"
                      p="sm"
                      bg={isSelected ? "violet.0" : undefined}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Badge variant="light">#{item.rank}</Badge>
                            <Text fw={700}>{item.fullName}</Text>
                            <Text size="xs" c="dimmed">
                              {item.employeeCode ?? item.employee.employeeCode}
                            </Text>
                          </Group>
                          <Group gap={6}>
                            <Badge color={scoreColor(item.score)}>
                              {item.score}/100
                            </Badge>
                            <Badge color={item.eligible === false ? "orange" : "green"} variant="light">
                              {tx(item.eligible === false ? "Fallback" : "Eligible")}
                            </Badge>
                            <Badge variant="outline">
                              {tx("Skill")}: {item.skillScore}
                            </Badge>
                            <Badge variant="outline">
                              {tx("Workload")}: {item.workloadScore}
                            </Badge>
                            <Badge variant="outline">
                              {tx("Availability")}: {item.availabilityScore}
                            </Badge>
                            {item.historyScore === null ||
                            item.historyScore === undefined ? null : (
                              <Badge variant="outline">
                                {tx("Track record")}: {item.historyScore}
                              </Badge>
                            )}
                          </Group>
                          {item.reason ? <AiReason reason={item.reason} /> : null}
                          {item.warnings?.length ? (
                            <Group gap={4}>
                              {item.warnings.map((warning) => (
                                <Badge key={warning} color="yellow" variant="light">
                                  {tx(warningLabel(warning))}
                                </Badge>
                              ))}
                            </Group>
                          ) : null}
                        </Stack>
                        <Tooltip label={isSelected ? tx("Selected") : tx("Select")}>
                          <ActionIcon
                            variant={isSelected ? "filled" : "light"}
                            color={isSelected ? "violet" : "teal"}
                            onClick={() => applyAiCandidate(item)}
                          >
                            <Check size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            ) : null}

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

function defaultRequiredSkill(): RequiredSkillForm {
  return {
    skillId: "",
    requiredProficiency: "INTERMEDIATE",
    importance: "IMPORTANT"
  };
}

const careerLevels: CareerLevel[] = ["INTERN", "FRESHER", "JUNIOR", "MIDDLE", "SENIOR", "LEAD"];

/** "Fresher - Junior", "from Middle", "up to Junior", or the team task's range. */
function formatLevelRange(
  task: Task,
  te: (value: string) => string,
  tx: (value: string) => string
) {
  const min = task.minLevel ?? task.parentTask?.minLevel ?? null;
  const max = task.maxLevel ?? task.parentTask?.maxLevel ?? null;
  if (min && max) {
    return min === max ? te(min) : `${te(min)} - ${te(max)}`;
  }
  if (min) {
    return `${tx("from")} ${te(min)}`;
  }
  if (max) {
    return `${tx("up to")} ${te(max)}`;
  }
  return tx("Any level");
}

function normalizeTaskPayload(values: {
  title: string;
  description: string;
  technologies: string[];
  parentTaskId: string;
  projectId: string;
  teamId: string;
  priority: TaskPriority;
  minLevel: CareerLevel | "";
  maxLevel: CareerLevel | "";
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
    technologies: values.technologies,
    parentTaskId: values.parentTaskId ? Number(values.parentTaskId) : undefined,
    projectId: values.projectId ? Number(values.projectId) : undefined,
    teamId: values.teamId ? Number(values.teamId) : undefined,
    priority: values.priority,
    // null clears a range on update; an empty range means any level.
    minLevel: values.minLevel || null,
    maxLevel: values.maxLevel || null,
    status: values.status,
    assigneeId: values.assigneeId ? Number(values.assigneeId) : undefined,
    startDate: values.startDate || undefined,
    dueDate: values.dueDate || undefined,
    estimatedHours:
      values.estimatedHours === "" ? null : Number(values.estimatedHours),
    actualHours: values.actualHours === "" ? null : Number(values.actualHours),
    requiredSkills: values.requiredSkills
      .filter((item) => item.skillId && item.requiredProficiency && item.importance)
      .map((item) => ({
        skillId: Number(item.skillId),
        requiredProficiency: item.requiredProficiency,
        importance: item.importance
      }))
  };
}

/**
 * The scoring reason is a full sentence. Clamping it to two lines cut it
 * mid-word, so it stays collapsed until the manager asks for it.
 */
function AiReason({ reason }: { reason: string }) {
  const { tx } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <Stack gap={4}>
      <Group
        gap={4}
        role="button"
        tabIndex={0}
        onClick={() => setOpened((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpened((open) => !open);
          }
        }}
        style={{ cursor: "pointer", width: "fit-content" }}
      >
        <ActionIcon size="sm" variant="subtle" color="gray" component="div">
          {opened ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </ActionIcon>
        <Text size="xs" c="dimmed" fw={600}>
          {tx("Why this candidate")}
        </Text>
      </Group>
      <Collapse in={opened}>
        <Text size="sm" c="dimmed">
          {reason}
        </Text>
      </Collapse>
    </Stack>
  );
}

function taskChildCount(task: Task) {
  return task.childTasks?.length ?? task._count?.childTasks ?? 0;
}

function formatTaskHours(task: Task) {
  const actualHours = Number(task.actualHours ?? 0);
  const estimatedHours =
    task.estimatedHours === null || task.estimatedHours === undefined
      ? "-"
      : `${Number(task.estimatedHours)}h`;
  return `${actualHours}h / ${estimatedHours}`;
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

function skillImportanceColor(importance: TaskSkillImportance) {
  switch (importance) {
    case "REQUIRED":
      return "red";
    case "IMPORTANT":
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

function scoreColor(score: number) {
  if (score >= 80) {
    return "green";
  }
  if (score >= 55) {
    return "yellow";
  }
  return "red";
}

function warningLabel(warning: string) {
  switch (warning) {
    case "NO_REQUIRED_SKILLS":
      return "No required skills";
    case "MISSING_REQUIRED_SKILLS":
      return "Missing required skills";
    case "REQUIRED_SKILL_BELOW_MINIMUM":
      return "Required skill below minimum";
    case "MISSING_IMPORTANT_SKILLS":
      return "Missing important skills";
    case "MISSING_NICE_TO_HAVE_SKILLS":
      return "Missing nice-to-have skills";
    case "TASK_DATE_RANGE_MISSING":
      return "Missing task dates";
    case "TASK_HAS_NO_WORKDAYS":
      return "No workdays";
    case "APPROVED_LEAVE_OVERLAP":
      return "Approved leave overlap";
    case "PENDING_LEAVE_OVERLAP":
      return "Pending leave overlap";
    case "NO_AVAILABLE_CAPACITY":
      return "No available capacity";
    case "HAS_OVERDUE_TASKS":
      return "Has overdue tasks";
    default:
      return warning;
  }
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
