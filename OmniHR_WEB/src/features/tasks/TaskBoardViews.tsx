import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Menu,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  MoreHorizontal,
  UserPlus
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatTeamName, statusColor } from "../../api/format";
import type { Task, TaskStatus } from "../../api/types";
import { EmployeeAvatar } from "../../components/EmployeeAvatar";
import { useTranslation } from "../../i18n";
import {
  dueTone,
  isExpanded,
  KANBAN_STATUSES,
  kanbanColumns,
  type BoardGroup,
  type ProjectSection,
  type TaskTreeRow
} from "./taskBoard";

export type TaskAction = {
  key: string;
  label: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
};

export type BoardHandlers = {
  today: string;
  onView: (task: TaskTreeRow) => void;
  actionsFor: (task: TaskTreeRow) => TaskAction[];
  /** The statuses the viewer may pick for this subtask, current one included; none means read-only. */
  statusChoicesFor: (task: TaskTreeRow) => TaskStatus[];
  onStatusChange: (task: TaskTreeRow, status: TaskStatus) => void;
  /** Set when the viewer may assign this subtask, turning "Unassigned" into a button. */
  assignFor: (task: TaskTreeRow) => (() => void) | null;
};

type TreeViewProps = BoardHandlers & {
  sections: ProjectSection[];
  filtered: boolean;
  toggledTaskIds: ReadonlySet<number>;
  onToggleTask: (taskId: number) => void;
  collapsedProjects: ReadonlySet<string>;
  onToggleProject: (key: string) => void;
};

/** Project > team task > subtask, with subtasks folded away until asked for. */
export function TaskTreeView(props: TreeViewProps) {
  const { tx, te } = useTranslation();
  const { sections, filtered, toggledTaskIds, onToggleTask, collapsedProjects, onToggleProject } = props;

  return (
    <Paper withBorder radius="md" className="table-shell">
      <ScrollArea type="auto">
        <Table verticalSpacing={6} highlightOnHover miw={820} className="task-tree">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{tx("Task")}</Table.Th>
              <Table.Th w={190}>{tx("Progress")}</Table.Th>
              <Table.Th w={200}>{tx("Assignee")}</Table.Th>
              <Table.Th w={120}>{tx("Due date")}</Table.Th>
              <Table.Th w={44} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sections.map((section) => {
              const collapsed = collapsedProjects.has(section.key);
              return [
                <Table.Tr key={section.key} bg="var(--mantine-color-default-hover)">
                  <Table.Td colSpan={5} py={8}>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon variant="subtle" size="sm" onClick={() => onToggleProject(section.key)}>
                        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </ActionIcon>
                      <FolderKanban size={18} color="var(--mantine-color-blue-6)" />
                      {section.project ? (
                        <Badge variant="light" color="blue" radius="sm">
                          {section.project.code}
                        </Badge>
                      ) : null}
                      <Text fw={800} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                        {section.project?.name ?? tx("No project")}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                        {section.groups.length} {tx("team tasks")}
                        {section.project?.endDate ? ` · ${tx("ends")} ${formatDate(section.project.endDate)}` : ""}
                      </Text>
                      {section.project && section.project.status !== "ACTIVE" ? (
                        <Badge size="xs" variant="light" color="gray">
                          {te(section.project.status)}
                        </Badge>
                      ) : null}
                    </Group>
                  </Table.Td>
                </Table.Tr>,
                ...(collapsed
                  ? []
                  : section.groups.flatMap((group) =>
                      teamTaskRows(group, isExpanded(group.root.id, filtered, toggledTaskIds), onToggleTask, props)
                    ))
              ];
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}

function teamTaskRows(
  group: BoardGroup,
  expanded: boolean,
  onToggleTask: (taskId: number) => void,
  handlers: BoardHandlers
) {
  const { root, children, hiddenCount } = group;
  const hasChildren = children.length + hiddenCount > 0;
  const rows = [
    <Table.Tr key={`task-${root.id}`}>
      <Table.Td>
        <Group gap={6} wrap="nowrap" pl={20} style={{ minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            disabled={!hasChildren}
            onClick={() => onToggleTask(root.id)}
            aria-label={expanded ? "collapse" : "expand"}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </ActionIcon>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <TaskTitle task={root} onView={handlers.onView} strong />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {formatTeamName(root.team)}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>
        <TeamTaskProgress group={group} />
      </Table.Td>
      <Table.Td>
        <AssigneeStack tasks={root.childTasks ?? []} />
      </Table.Td>
      <Table.Td>
        <DueDate task={root} today={handlers.today} />
      </Table.Td>
      <Table.Td>
        <TaskActionsMenu actions={handlers.actionsFor(root)} />
      </Table.Td>
    </Table.Tr>
  ];
  if (!expanded) {
    return rows;
  }
  for (const child of children) {
    rows.push(
      <Table.Tr key={`task-${child.id}`}>
        <Table.Td>
          <Group gap={8} wrap="nowrap" pl={58} style={{ minWidth: 0 }}>
            <span className="task-tree-dot" style={{ background: `var(--mantine-color-${statusColor(child.status)}-5)` }} />
            <TaskTitle task={child} onView={handlers.onView} />
          </Group>
        </Table.Td>
        <Table.Td>
          <StatusControl task={child} handlers={handlers} />
        </Table.Td>
        <Table.Td>
          <Assignee task={child} handlers={handlers} />
        </Table.Td>
        <Table.Td>
          <DueDate task={child} today={handlers.today} />
        </Table.Td>
        <Table.Td>
          <TaskActionsMenu actions={handlers.actionsFor(child)} />
        </Table.Td>
      </Table.Tr>
    );
  }
  if (hiddenCount) {
    rows.push(<HiddenRow key={`hidden-${root.id}`} count={hiddenCount} />);
  }
  return rows;
}

function HiddenRow({ count }: { count: number }) {
  const { tx } = useTranslation();
  return (
    <Table.Tr>
      <Table.Td colSpan={5} py={4}>
        <Text size="xs" c="dimmed" pl={58} fs="italic">
          + {count} {tx("more subtasks hidden by the filter")}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

type KanbanViewProps = BoardHandlers & { sections: ProjectSection[] };

/** The page's subtasks as cards in one column per status. */
export function TaskKanbanView({ sections, ...handlers }: KanbanViewProps) {
  const { tx, te } = useTranslation();
  const columns = kanbanColumns(sections);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
      {KANBAN_STATUSES.map((status) => (
        <Paper key={status} withBorder radius="md" p="xs" bg="var(--mantine-color-default-hover)">
          <Group justify="space-between" mb="xs" px={4}>
            <Group gap={6}>
              <span className="task-tree-dot" style={{ background: `var(--mantine-color-${statusColor(status)}-5)` }} />
              <Text fw={700} size="sm">
                {te(status)}
              </Text>
            </Group>
            <Badge size="sm" variant="light" color="gray">
              {columns[status].length}
            </Badge>
          </Group>
          {/* Each column scrolls by itself, so a long "done" column does not stretch the page. */}
          <ScrollArea.Autosize mah="70vh" type="auto" offsetScrollbars>
            <Stack gap="xs">
              {columns[status].length ? (
                columns[status].map((task) => <KanbanCard key={task.id} task={task} handlers={handlers} />)
              ) : (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  {tx("Nothing here")}
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

function KanbanCard({ task, handlers }: { task: TaskTreeRow; handlers: BoardHandlers }) {
  return (
    <Paper withBorder radius="md" p="sm" shadow="xs">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Text size="xs" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
            {task.project?.code ? `${task.project.code} · ` : ""}
            {task.rowParent?.title ?? task.parentTask?.title}
          </Text>
          <TaskActionsMenu actions={handlers.actionsFor(task)} />
        </Group>
        <TaskTitle task={task} onView={handlers.onView} strong lines={2} />
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Assignee task={task} handlers={handlers} compact />
          <DueDate task={task} today={handlers.today} />
        </Group>
        <StatusControl task={task} handlers={handlers} />
      </Stack>
    </Paper>
  );
}

function TaskTitle({
  task,
  onView,
  strong,
  lines = 1
}: {
  task: TaskTreeRow;
  onView: (task: TaskTreeRow) => void;
  strong?: boolean;
  lines?: number;
}) {
  return (
    <UnstyledButton onClick={() => onView(task)} style={{ minWidth: 0 }}>
      <Text fw={strong ? 700 : 500} size="sm" lineClamp={lines} className="task-title-link">
        {task.title}
      </Text>
    </UnstyledButton>
  );
}

function TeamTaskProgress({ group }: { group: BoardGroup }) {
  const { tx, te } = useTranslation();
  const { done, total } = group.progress;
  if (!total) {
    return (
      <Stack gap={2}>
        <Badge size="sm" variant="light" color={statusColor(group.root.status)}>
          {te(group.root.status)}
        </Badge>
        <Text size="xs" c="dimmed">
          {tx("Not split yet")}
        </Text>
      </Stack>
    );
  }
  const value = Math.round((done / total) * 100);
  return (
    <Tooltip label={te(group.root.status)} openDelay={300}>
      <Group gap={8} wrap="nowrap">
        <Progress value={value} color={done === total ? "green" : "blue"} size="md" radius="xl" style={{ flex: 1 }} />
        <Text size="xs" fw={600} c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {done}/{total}
        </Text>
      </Group>
    </Tooltip>
  );
}

/** Who is working on a team task, from its subtasks. */
function AssigneeStack({ tasks }: { tasks: Task[] }) {
  const { tx } = useTranslation();
  const people = new Map<number, NonNullable<Task["assignee"]>>();
  tasks.forEach((task) => {
    if (task.assignee && task.status !== "CANCELLED") {
      people.set(task.assignee.id, task.assignee);
    }
  });
  const list = Array.from(people.values());
  const unassigned = tasks.filter(
    (task) => !task.assigneeId && (task.status === "TODO" || task.status === "IN_PROGRESS")
  ).length;
  if (!list.length && !unassigned) {
    return (
      <Text size="xs" c="dimmed">
        -
      </Text>
    );
  }
  return (
    <Group gap={6} wrap="nowrap">
      {list.length ? (
        <Tooltip label={list.map((person) => person.fullName).join(", ")} multiline maw={260}>
          <Avatar.Group spacing={6}>
            {list.slice(0, 4).map((person) => (
              <EmployeeAvatar key={person.id} employee={person} size={30} radius="xl" />
            ))}
            {list.length > 4 ? (
              <Avatar size={30} radius="xl">
                +{list.length - 4}
              </Avatar>
            ) : null}
          </Avatar.Group>
        </Tooltip>
      ) : null}
      {unassigned ? (
        <Badge size="xs" variant="light" color="orange">
          {unassigned} {tx("unassigned")}
        </Badge>
      ) : null}
    </Group>
  );
}

function Assignee({ task, handlers, compact }: { task: TaskTreeRow; handlers: BoardHandlers; compact?: boolean }) {
  const { tx } = useTranslation();
  if (task.assignee) {
    return (
      <Tooltip label={`${task.assignee.fullName} (${task.assignee.employeeCode})`} openDelay={300}>
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <EmployeeAvatar employee={task.assignee} size={compact ? 22 : 26} />
          <Text size={compact ? "xs" : "sm"} lineClamp={1}>
            {task.assignee.fullName}
          </Text>
        </Group>
      </Tooltip>
    );
  }
  const assign = handlers.assignFor(task);
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return (
      <Text size="xs" c="dimmed">
        -
      </Text>
    );
  }
  return assign ? (
    <Badge
      component="button"
      type="button"
      size="sm"
      variant="light"
      color="orange"
      leftSection={<UserPlus size={12} />}
      style={{ cursor: "pointer" }}
      onClick={assign}
    >
      {tx("Unassigned")}
    </Badge>
  ) : (
    <Badge size="sm" variant="light" color="orange">
      {tx("Unassigned")}
    </Badge>
  );
}

/** A status badge; where the viewer may move the task, a click opens the allowed moves. */
function StatusControl({ task, handlers }: { task: TaskTreeRow; handlers: BoardHandlers }) {
  const { te, tx } = useTranslation();
  const moves = handlers.statusChoicesFor(task).filter((status) => status !== task.status);
  const badge = (clickable: boolean) => (
    <Badge
      size="md"
      variant="light"
      color={statusColor(task.status)}
      rightSection={clickable ? <ChevronDown size={12} /> : undefined}
      style={clickable ? { cursor: "pointer" } : undefined}
    >
      {te(task.status)}
    </Badge>
  );
  if (!moves.length) {
    return badge(false);
  }
  return (
    <Menu position="bottom-start" withinPortal shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label={tx("Change status")} style={{ width: "fit-content" }}>
          {badge(true)}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{tx("Change status")}</Menu.Label>
        {moves.map((status) => (
          <Menu.Item
            key={status}
            leftSection={
              <span className="task-tree-dot" style={{ background: `var(--mantine-color-${statusColor(status)}-5)` }} />
            }
            onClick={() => handlers.onStatusChange(task, status)}
          >
            {te(status)}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** The due date, red once it has passed and orange in the last three days. */
export function DueDate({ task, today }: { task: Pick<Task, "dueDate" | "status">; today: string }) {
  const { tx } = useTranslation();
  const tone = dueTone(task, today);
  if (tone === "none") {
    return (
      <Text size="xs" c="dimmed">
        -
      </Text>
    );
  }
  const color = tone === "overdue" ? "red" : tone === "soon" ? "orange" : tone === "closed" ? "dimmed" : undefined;
  const icon =
    tone === "overdue" ? <AlertTriangle size={13} /> : tone === "soon" ? <Clock size={13} /> : null;
  const text = (
    <Group gap={4} wrap="nowrap" c={color}>
      {icon}
      <Text size="sm" fw={tone === "overdue" || tone === "soon" ? 700 : 400} c={color} style={{ whiteSpace: "nowrap" }}>
        {formatDate(task.dueDate)}
      </Text>
    </Group>
  );
  return tone === "overdue" || tone === "soon" ? (
    <Tooltip label={tx(tone === "overdue" ? "Overdue" : "Due within 3 days")}>{text}</Tooltip>
  ) : (
    text
  );
}

/** Every action on a task behind one button, instead of a row of icons. */
function TaskActionsMenu({ actions }: { actions: TaskAction[] }) {
  const { tx } = useTranslation();
  if (!actions.length) {
    return null;
  }
  const danger = actions.filter((action) => action.color === "red");
  const rest = actions.filter((action) => action.color !== "red");
  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={tx("More actions")}>
          <MoreHorizontal size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {rest.map((action) => (
          <Menu.Item key={action.key} leftSection={action.icon} color={action.color} onClick={action.onClick}>
            {action.label}
          </Menu.Item>
        ))}
        {danger.length && rest.length ? <Menu.Divider /> : null}
        {danger.map((action) => (
          <Menu.Item key={action.key} leftSection={action.icon} color="red" onClick={action.onClick}>
            {action.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
