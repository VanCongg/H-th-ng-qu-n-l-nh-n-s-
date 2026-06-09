import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
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
import { formatDate, statusColor } from "../../api/format";
import type { LeaveRequest } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PermissionGate } from "../../components/PermissionGate";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";

type LeaveRequestsPageProps = {
  scope: "all" | "team";
};

export function LeaveRequestsPage({ scope }: LeaveRequestsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const hasEmployeeProfile = useAuthStore((state) => Boolean(state.user?.employeeId));

  const query = useQuery({
    queryKey: ["leave-requests", scope, status],
    queryFn: () => scope === "team" ? leaveRequestsApi.team({ status, limit: 50 }) : leaveRequestsApi.list({ status, limit: 50 })
  });
  const leaveTypesQuery = useQuery({ queryKey: ["leave-types"], queryFn: leaveTypesApi.list });

  const form = useForm({ initialValues: { leaveTypeId: "", startDate: "", endDate: "", reason: "" } });
  const rejectForm = useForm({ initialValues: { rejectionReason: "" } });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) => leaveRequestsApi.create({ ...values, leaveTypeId: Number(values.leaveTypeId) }),
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
    mutationFn: (values: { id: number; reason: string }) => leaveRequestsApi.reject(values.id, values.reason),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave rejected") });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setRejecting(null);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const cancelMutation = useMutation({
    mutationFn: leaveRequestsApi.cancel,
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
        <Select label={tx("Status")} data={["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((value) => ({ value, label: te(value) }))} clearable value={status} onChange={setStatus} />
      </Paper>
      <DataTable<LeaveRequest>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        columns={[
          { key: "employee", label: "Employee", render: (item) => <Stack gap={0}><Text fw={700}>{item.employee.fullName}</Text><Text size="xs" c="dimmed">{item.employee.employeeCode}</Text></Stack> },
          { key: "type", label: "Type", render: (item) => item.leaveType.name },
          { key: "dates", label: "Dates", render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` },
          { key: "days", label: "Days", render: (item) => item.totalDays },
          { key: "status", label: "Status", render: (item) => <Badge color={statusColor(item.status)}>{te(item.status)}</Badge> },
          { key: "reason", label: "Reason", render: (item) => item.reason },
          { key: "actions", label: "", render: (item) => item.status === "PENDING" ? (
            <Group justify="flex-end" gap={4}>
              <Tooltip label={tx("Approve")}><ActionIcon color="green" variant="subtle" onClick={() => approveMutation.mutate(item.id)}><Check size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Reject")}><ActionIcon color="red" variant="subtle" onClick={() => setRejecting(item)}><X size={16} /></ActionIcon></Tooltip>
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
            <Textarea label={tx("Reason")} required autosize minRows={3} {...form.getInputProps("reason")} />
            <Button type="submit" loading={createMutation.isPending}>{tx("Submit")}</Button>
          </Stack>
        </form>
      </Modal>
      <Modal opened={Boolean(rejecting)} onClose={() => setRejecting(null)} title={tx("Reject leave request")}>
        <form
          onSubmit={rejectForm.onSubmit((values) => {
            if (rejecting) {
              rejectMutation.mutate({
                id: rejecting.id,
                reason: values.rejectionReason
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
