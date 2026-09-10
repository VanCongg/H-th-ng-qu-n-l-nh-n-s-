import {
  ActionIcon,
  Badge,
  Button,
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
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Sparkles } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { aiTaskSuggestionsApi, projectsApi, tasksApi } from "../../api/endpoints";
import { formatDateTime, statusColor } from "../../api/format";
import type {
  AiTaskSuggestion,
  AiTaskSuggestionItem,
  AiTaskSuggestionStatus
} from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

const suggestionStatuses: AiTaskSuggestionStatus[] = [
  "GENERATED",
  "SELECTED",
  "EXPIRED",
  "CANCELLED"
];

type AiTaskSuggestionsPageProps = {
  scope: "all" | "team";
};

export function AiTaskSuggestionsPage({ scope }: AiTaskSuggestionsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [status, setStatus] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<AiTaskSuggestion | null>(null);

  const canGenerate = hasPermission("AI_TASK_SUGGEST");
  const canSelect = hasPermission("AI_TASK_SELECT");

  const tasksQuery = useQuery({
    queryKey: ["tasks", scope, "ai-task-options"],
    queryFn: () =>
      scope === "team"
        ? tasksApi.team({ limit: 100 })
        : tasksApi.list({ limit: 100 })
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", scope, "ai-filter-options"],
    queryFn: () => projectsApi.list({ limit: 100 })
  });
  const suggestionsQuery = useQuery({
    queryKey: ["ai-task-suggestions", scope, status, taskId, page],
    queryFn: () =>
      aiTaskSuggestionsApi.list({
        status: status || undefined,
        taskId: taskId ? Number(taskId) : undefined,
        page,
        limit: 20
      })
  });

  const form = useForm({
    initialValues: {
      taskId: "",
      limit: 5,
      includeAvailability: true,
      includePerformance: true
    },
    validate: {
      taskId: (value) => (value ? null : tx("Required"))
    }
  });

  const generateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      aiTaskSuggestionsApi.generate(Number(values.taskId), {
        limit: Number(values.limit || 5),
        includeAvailability: Boolean(values.includeAvailability),
        includePerformance: Boolean(values.includePerformance)
      }),
    onSuccess: (result) => {
      notifications.show({ color: "green", message: tx("AI suggestion generated") });
      queryClient.invalidateQueries({ queryKey: ["ai-task-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedSuggestion(result);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const selectMutation = useMutation({
    mutationFn: (values: { suggestionId: number; suggestionItemId: number }) =>
      aiTaskSuggestionsApi.select(values.suggestionId, {
        suggestionItemId: values.suggestionItemId,
        note: "Selected from OmniHR web"
      }),
    onSuccess: (result) => {
      notifications.show({ color: "green", message: tx("AI suggestion selected") });
      queryClient.invalidateQueries({ queryKey: ["ai-task-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-workload"] });
      setSelectedSuggestion(result);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const taskOptions = (tasksQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.title}${item.project?.code ? ` (${item.project.code})` : ""}`
  }));
  const projectOptions = (projectsQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} - ${item.name}`
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title="AI Task Suggestions"
        description="Generate rule-based assignee suggestions and let a manager select the final assignee."
      />

      {canGenerate ? (
        <Paper withBorder radius="md" p="md" className="filter-bar">
          <form onSubmit={form.onSubmit((values) => generateMutation.mutate(values))}>
            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
              <Select
                label={tx("Task")}
                data={taskOptions}
                searchable
                required
                {...form.getInputProps("taskId")}
              />
              <NumberInput
                label={tx("Candidate limit")}
                min={1}
                max={20}
                {...form.getInputProps("limit")}
              />
              <Switch
                label={tx("Include leave availability")}
                mt="lg"
                {...form.getInputProps("includeAvailability", { type: "checkbox" })}
              />
              <Switch
                label={tx("Include past review ratings")}
                mt="lg"
                {...form.getInputProps("includePerformance", { type: "checkbox" })}
              />
              <Group align="flex-end">
                <Button
                  type="submit"
                  leftSection={<Sparkles size={16} />}
                  loading={generateMutation.isPending}
                >
                  {tx("Generate")}
                </Button>
              </Group>
            </SimpleGrid>
          </form>
        </Paper>
      ) : null}

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select
            label={tx("Status")}
            data={suggestionStatuses.map((value) => ({ value, label: te(value) }))}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            clearable
          />
          <Select
            label={tx("Task")}
            data={taskOptions}
            value={taskId}
            onChange={(value) => {
              setTaskId(value);
              setPage(1);
            }}
            clearable
            searchable
          />
          <Select
            label={tx("Project")}
            data={projectOptions}
            clearable
            searchable
            disabled
            placeholder={tx("Use task filter")}
          />
        </SimpleGrid>
      </Paper>

      <DataTable<AiTaskSuggestion>
        data={suggestionsQuery.data?.items ?? []}
        loading={suggestionsQuery.isLoading}
        error={
          suggestionsQuery.error ? getApiErrorMessage(suggestionsQuery.error) : null
        }
        total={suggestionsQuery.data?.meta.total}
        limit={suggestionsQuery.data?.meta.limit}
        page={suggestionsQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "task",
            label: "Task",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.task.title}</Text>
                <Text size="xs" c="dimmed">
                  {item.task.project?.code ?? tx("No project")}
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
          { key: "algorithm", label: "Algorithm", render: (item) => item.algorithmVersion },
          { key: "created", label: "Created at", render: (item) => formatDateTime(item.createdAt) },
          {
            key: "top",
            label: "Top candidate",
            render: (item) => {
              const top = item.items[0];
              return top ? `${top.fullName} (${top.score})` : "-";
            }
          },
          {
            key: "actions",
            label: "",
            width: 72,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                <Tooltip label={tx("View")}>
                  <ActionIcon variant="subtle" onClick={() => setSelectedSuggestion(item)}>
                    <Eye size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />

      <Modal
        opened={Boolean(selectedSuggestion)}
        onClose={() => setSelectedSuggestion(null)}
        title={tx("AI suggestion details")}
        // The per-candidate reason is a full sentence, and the score breakdown
        // now carries a fifth column, so the default xl modal wraps it to one
        // word per line.
        size="90%"
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={0}>
              <Text fw={800}>{selectedSuggestion?.task.title}</Text>
              <Text size="sm" c="dimmed">
                {selectedSuggestion?.algorithmVersion}
              </Text>
            </Stack>
            {selectedSuggestion ? (
              <Badge color={statusColor(selectedSuggestion.status)}>
                {te(selectedSuggestion.status)}
              </Badge>
            ) : null}
          </Group>

          <DataTable<AiTaskSuggestionItem>
            data={selectedSuggestion?.items ?? []}
            columns={[
              { key: "rank", label: "Rank", render: (item) => item.rank },
              {
                key: "employee",
                label: "Employee",
                render: (item) => (
                  <Stack gap={0}>
                    <Text fw={700}>{item.fullName}</Text>
                    <Text size="xs" c="dimmed">
                      {item.employee.employeeCode}
                    </Text>
                  </Stack>
                )
              },
              {
                key: "score",
                label: "Score",
                render: (item) => (
                  <Stack gap={4}>
                    <Progress value={item.score} color={scoreColor(item.score)} />
                    <Text size="xs" c="dimmed">
                      {item.score}/100
                    </Text>
                  </Stack>
                )
              },
              { key: "skill", label: "Skill", render: (item) => item.skillScore },
              { key: "workload", label: "Workload", render: (item) => item.workloadScore },
              { key: "availability", label: "Availability", render: (item) => item.availabilityScore },
              {
                key: "performance",
                label: "Performance",
                render: (item) =>
                  item.performanceScore ?? (
                    <Text size="xs" c="dimmed">
                      {tx("No reviews yet")}
                    </Text>
                  )
              },
              { key: "reason", label: "Reason", render: (item) => item.reason ?? "-" },
              {
                key: "actions",
                label: "",
                width: 96,
                render: (item) =>
                  selectedSuggestion?.status === "GENERATED" && canSelect ? (
                    <Tooltip label={tx("Select")}>
                      <ActionIcon
                        variant="subtle"
                        color={item.selected ? "green" : "teal"}
                        loading={selectMutation.isPending}
                        onClick={() =>
                          selectedSuggestion
                            ? selectMutation.mutate({
                                suggestionId: selectedSuggestion.id,
                                suggestionItemId: item.suggestionItemId
                              })
                            : undefined
                        }
                      >
                        <Check size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : item.selected ? (
                    <Badge color="green">{tx("Selected")}</Badge>
                  ) : null
              }
            ]}
          />
        </Stack>
      </Modal>
    </Stack>
  );
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
