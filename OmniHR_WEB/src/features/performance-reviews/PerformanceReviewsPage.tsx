import { Badge, Button, Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { performanceReviewsApi, reviewCyclesApi } from "../../api/endpoints";
import type { PerformanceReview, PerformanceReviewStatus } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

type PerformanceReviewsPageProps = {
  scope: "all" | "team";
};

function statusColor(status: PerformanceReview["status"]) {
  switch (status) {
    case "FINALIZED":
      return "green";
    case "MANAGER_REVIEWED":
      return "blue";
    case "SELF_SUBMITTED":
      return "yellow";
    default:
      return "gray";
  }
}

const ratingOptions = ["1", "2", "3", "4", "5"].map((value) => ({ value, label: value }));

const reviewStatuses: PerformanceReviewStatus[] = [
  "PENDING_SELF",
  "SELF_SUBMITTED",
  "MANAGER_REVIEWED",
  "FINALIZED"
];

export function PerformanceReviewsPage({ scope }: PerformanceReviewsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    scope === "team" ? "SELF_SUBMITTED" : "MANAGER_REVIEWED"
  );
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<PerformanceReview | null>(null);

  const listQuery = useQuery({
    queryKey: ["performance-reviews", scope, cycleId, status, page],
    queryFn: () => {
      const params = {
        cycleId: cycleId ? Number(cycleId) : undefined,
        status: status ?? undefined,
        page,
        limit: 20
      };
      return scope === "team" ? performanceReviewsApi.team(params) : performanceReviewsApi.list(params);
    }
  });
  const cyclesQuery = useQuery({ queryKey: ["review-cycles-filter"], queryFn: reviewCyclesApi.list });

  const reviewForm = useForm({ initialValues: { managerRating: "5", managerComment: "" } });

  const submitManagerMutation = useMutation({
    mutationFn: (values: { id: number; managerRating: number; managerComment: string }) =>
      performanceReviewsApi.submitManager(values.id, {
        managerRating: values.managerRating,
        managerComment: values.managerComment
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Review submitted") });
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      setReviewing(null);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const finalizeMutation = useMutation({
    mutationFn: (id: number) => performanceReviewsApi.finalize(id),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Review finalized") });
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const cycleOptions = (cyclesQuery.data ?? []).map((cycle) => ({
    value: String(cycle.id),
    label: cycle.name
  }));

  function openReview(review: PerformanceReview) {
    reviewForm.setValues({ managerRating: "5", managerComment: "" });
    setReviewing(review);
  }

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "Team Reviews" : "Performance Reviews"}
        description={
          scope === "team"
            ? "Review your team's self-assessments and submit your ratings."
            : "Track performance reviews across the organization and finalize completed ones."
        }
      />
      <Group align="flex-end">
        <Select
          label={tx("Cycle")}
          placeholder={tx("All cycles")}
          data={cycleOptions}
          clearable
          value={cycleId}
          onChange={(value) => {
            setCycleId(value);
            setPage(1);
          }}
          w={260}
        />
        <Select
          label={tx("Status")}
          placeholder={tx("All statuses")}
          data={reviewStatuses.map((value) => ({ value, label: te(value) }))}
          clearable
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          w={240}
        />
      </Group>
      <DataTable<PerformanceReview>
        data={listQuery.data?.items ?? []}
        loading={listQuery.isLoading}
        error={listQuery.error ? getApiErrorMessage(listQuery.error) : null}
        total={listQuery.data?.meta.total}
        limit={listQuery.data?.meta.limit}
        page={listQuery.data?.meta.page}
        onPageChange={setPage}
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
          { key: "cycle", label: "Cycle", render: (item) => item.cycle.name },
          { key: "selfRating", label: "Self rating", render: (item) => item.selfRating ?? "-" },
          { key: "managerRating", label: "Manager rating", render: (item) => item.managerRating ?? "-" },
          { key: "finalRating", label: "Final rating", render: (item) => item.finalRating ?? "-" },
          {
            key: "status",
            label: "Status",
            render: (item) => <Badge color={statusColor(item.status)}>{te(item.status)}</Badge>
          },
          {
            key: "actions",
            label: "",
            render: (item) => {
              if (scope === "team" && item.status === "SELF_SUBMITTED") {
                return (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<ClipboardCheck size={14} />}
                    onClick={() => openReview(item)}
                  >
                    {tx("Review")}
                  </Button>
                );
              }
              if (scope === "all" && item.status === "MANAGER_REVIEWED") {
                return (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<CheckCircle2 size={14} />}
                    loading={finalizeMutation.isPending}
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Finalize review"),
                        message: tx("Finalize this performance review?"),
                        confirmLabel: tx("Finalize"),
                        onConfirm: () => finalizeMutation.mutate(item.id)
                      })
                    }
                  >
                    {tx("Finalize")}
                  </Button>
                );
              }
              return null;
            }
          }
        ]}
      />
      <Modal opened={reviewing != null} onClose={() => setReviewing(null)} title={tx("Submit manager review")}>
        {reviewing ? (
          <form
            onSubmit={reviewForm.onSubmit((values) =>
              submitManagerMutation.mutate({
                id: reviewing.id,
                managerRating: Number(values.managerRating),
                managerComment: values.managerComment
              })
            )}
          >
            <Stack>
              <Text size="sm" c="dimmed">
                {reviewing.employee.fullName} · {reviewing.cycle.name}
              </Text>
              {reviewing.selfComment ? (
                <Text size="sm">
                  <Text span fw={700}>
                    {tx("Self comment")}:
                  </Text>{" "}
                  {reviewing.selfComment}
                </Text>
              ) : null}
              <Select
                label={tx("Manager rating")}
                data={ratingOptions}
                required
                allowDeselect={false}
                {...reviewForm.getInputProps("managerRating")}
              />
              <Textarea
                label={tx("Manager comment")}
                minRows={3}
                {...reviewForm.getInputProps("managerComment")}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={submitManagerMutation.isPending}>
                  {tx("Save")}
                </Button>
              </Group>
            </Stack>
          </form>
        ) : null}
      </Modal>
    </Stack>
  );
}
