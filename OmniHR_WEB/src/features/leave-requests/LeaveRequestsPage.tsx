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
import { Ban, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { leaveRequestsApi, leaveTypesApi } from "../../api/endpoints";
import { formatDate, monthOptions, statusColor, yearOptions } from "../../api/format";
import type { LeaveHalf, LeaveRequest } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PermissionGate } from "../../components/PermissionGate";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

/** Filter value for approved leave whose owner asked to withdraw it. */
const CANCEL_REQUESTED = "CANCEL_REQUESTED";

const HALF_LABELS: Record<LeaveHalf, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon"
};

type LeaveRequestsPageProps = {
  scope: "all" | "team";
};

export function LeaveRequestsPage({ scope }: LeaveRequestsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  // Turning down either the leave itself or a request to withdraw it.
  const [rejecting, setRejecting] = useState<{ item: LeaveRequest; kind: "leave" | "cancel" } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // No month means every request; a month keeps those with a leave day in it.
  const [month, setMonth] = useState<string | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [page, setPage] = useState(1);
  const hasEmployeeProfile = useAuthStore((state) => Boolean(state.user?.employeeId));

  const query = useQuery({
    queryKey: ["leave-requests", scope, status, month, year, page],
    queryFn: () => {
      // "Asked to cancel" is not a status: the leave is still APPROVED.
      const params = {
        ...(status === CANCEL_REQUESTED ? { cancelRequested: true } : { status }),
        month: month ? Number(month) : undefined,
        year: month ? year : undefined,
        page,
        limit: 20
      };
      return scope === "team" ? leaveRequestsApi.team(params) : leaveRequestsApi.list(params);
    }
  });
  const leaveTypesQuery = useQuery({ queryKey: ["leave-types"], queryFn: leaveTypesApi.list });

  const form = useForm({ initialValues: { leaveTypeId: "", startDate: "", endDate: "", reason: "", halfDay: "" } });
  // A half day only exists for a one-day request.
  const singleDay = Boolean(form.values.startDate) && form.values.startDate === form.values.endDate;
  const rejectForm = useForm({ initialValues: { rejectionReason: "" } });

  const createMutation = useMutation({
    mutationFn: ({ halfDay, ...values }: typeof form.values) =>
      leaveRequestsApi.create({
        ...values,
        leaveTypeId: Number(values.leaveTypeId),
        ...(singleDay && halfDay ? { halfDay } : {})
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave request created") });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const approveMutation = useMutation({
    mutationFn: leaveRequestsApi.approve,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave approved") });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const rejectMutation = useMutation({
    mutationFn: (values: { id: number; reason: string; kind: "leave" | "cancel" }) =>
      values.kind === "cancel"
        ? leaveRequestsApi.rejectCancellation(values.id, values.reason)
        : leaveRequestsApi.reject(values.id, values.reason),
    onSuccess: (_data, values) => {
      notifications.show({
        color: "green",
        message: tx(values.kind === "cancel" ? "Cancellation declined; the leave stands" : "Leave rejected")
      });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setRejecting(null);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const approveCancellationMutation = useMutation({
    mutationFn: leaveRequestsApi.approveCancellation,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave cancelled") });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const cancelMutation = useMutation({
    mutationFn: (id: number) => leaveRequestsApi.cancel(id),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave cancelled") });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const leaveTypeOptions = (leaveTypesQuery.data ?? []).filter((item) => item.isActive).map((item) => ({
    value: String(item.id),
    label: item.name
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "Team Leave Requests" : "Leave Requests"}
        description={scope === "team" ? "Approve or reject pending requests from subordinates." : "View and process all leave requests."}
        actions={hasEmployeeProfile ? <Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>{tx("New leave request")}</Button> : null}
      />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          <Select
            label={tx("Status")}
            data={[
              ...["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((value) => ({ value, label: te(value) })),
              { value: CANCEL_REQUESTED, label: tx("Asked to cancel") }
            ]}
            clearable
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Month")}
            placeholder={tx("All months")}
            data={monthOptions(tx("Month"))}
            clearable
            value={month}
            onChange={(value) => {
              setMonth(value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Year")}
            data={yearOptions()}
            value={String(year)}
            allowDeselect={false}
            disabled={!month}
            onChange={(value) => {
              setYear(Number(value));
              setPage(1);
            }}
          />
        </SimpleGrid>
      </Paper>
      <DataTable<LeaveRequest>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        columns={[
          { key: "employee", label: "Employee", render: (item) => <Stack gap={0}><Text fw={700}>{item.employee.fullName}</Text><Text size="xs" c="dimmed">{item.employee.employeeCode}</Text></Stack> },
          { key: "type", label: "Type", render: (item) => item.leaveType.name },
          { key: "dates", label: "Dates", render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` },
          {
            key: "days",
            label: "Days",
            render: (item) => (item.halfDay ? `${item.totalDays} (${tx(HALF_LABELS[item.halfDay])})` : item.totalDays)
          },
          {
            key: "status",
            label: "Status",
            render: (item) => (
              <Group gap={4} wrap="nowrap">
                <Badge color={statusColor(item.status)}>{te(item.status)}</Badge>
                {item.status === "APPROVED" && item.cancelRequestedAt ? (
                  <Badge color="orange" variant="light">{tx("Asked to cancel")}</Badge>
                ) : null}
              </Group>
            )
          },
          {
            key: "reason",
            label: "Reason",
            render: (item) => (
              <Stack gap={2}>
                <Text size="sm">{item.reason}</Text>
                {item.status === "APPROVED" && item.cancelRequestedAt && item.cancelRequestReason ? (
                  <Text size="xs" c="orange">{tx("Why cancel")}: {item.cancelRequestReason}</Text>
                ) : null}
              </Stack>
            )
          },
          { key: "actions", label: "", render: (item) => item.status === "APPROVED" && item.cancelRequestedAt ? (
            <Group justify="flex-end" gap={4}>
              <Tooltip label={tx("Accept the cancellation")}><ActionIcon color="green" variant="subtle" loading={approveCancellationMutation.isPending} onClick={() => approveCancellationMutation.mutate(item.id)}><Check size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Keep the leave")}><ActionIcon color="red" variant="subtle" onClick={() => setRejecting({ item, kind: "cancel" })}><X size={16} /></ActionIcon></Tooltip>
            </Group>
          ) : item.status === "PENDING" ? (
            <Group justify="flex-end" gap={4}>
              <Tooltip label={tx("Approve")}><ActionIcon color="green" variant="subtle" onClick={() => approveMutation.mutate(item.id)}><Check size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Reject")}><ActionIcon color="red" variant="subtle" onClick={() => setRejecting({ item, kind: "leave" })}><X size={16} /></ActionIcon></Tooltip>
              <PermissionGate roles={["ADMIN"]}>
                <Tooltip label={tx("Cancel")}><ActionIcon color="gray" variant="subtle" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate(item.id)}><Ban size={16} /></ActionIcon></Tooltip>
              </PermissionGate>
            </Group>
          ) : null }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={tx("New leave request")}>
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <Select label={tx("Leave type")} data={leaveTypeOptions} required {...form.getInputProps("leaveTypeId")} />
            <TextInput label={tx("Start date")} type="date" required {...form.getInputProps("startDate")} />
            <TextInput label={tx("End date")} type="date" required {...form.getInputProps("endDate")} />
            <Select
              label={tx("Part of the day")}
              description={tx("A half day is only for a one-day request")}
              disabled={!singleDay}
              data={[
                { value: "", label: tx("Full day") },
                { value: "MORNING", label: tx(HALF_LABELS.MORNING) },
                { value: "AFTERNOON", label: tx(HALF_LABELS.AFTERNOON) }
              ]}
              allowDeselect={false}
              {...form.getInputProps("halfDay")}
            />
            <Textarea label={tx("Reason")} required autosize minRows={3} {...form.getInputProps("reason")} />
            <Button type="submit" loading={createMutation.isPending}>{tx("Submit")}</Button>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={tx(rejecting?.kind === "cancel" ? "Keep the leave" : "Reject leave request")}
      >
        <form
          onSubmit={rejectForm.onSubmit((values) => {
            if (rejecting) {
              rejectMutation.mutate({
                id: rejecting.item.id,
                reason: values.rejectionReason,
                kind: rejecting.kind
              });
            }
          })}
        >
          <Stack>
            <Textarea label={tx("Rejection reason")} required autosize minRows={3} {...rejectForm.getInputProps("rejectionReason")} />
            <Button color="red" type="submit" loading={rejectMutation.isPending}>{tx("Reject")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
