import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { getApiErrorMessage } from "../../api/axios";
import { leaveTypesApi } from "../../api/endpoints";
import type { LeaveType } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PermissionGate } from "../../components/PermissionGate";
import { useTranslation } from "../../i18n";

function showError(error: unknown) {
  notifications.show({ color: "red", message: getApiErrorMessage(error) });
}

type LeaveTypeFormModalProps = {
  opened: boolean;
  editing: LeaveType | null;
  onClose: () => void;
};

/** Mount with a new `key` for each open so the form starts from `editing`. */
export function LeaveTypeFormModal({ opened, editing, onClose }: LeaveTypeFormModalProps) {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: {
      code: editing?.code ?? "",
      name: editing?.name ?? "",
      annualAllowance: editing?.annualAllowance ?? 0,
      isPaid: editing?.isPaid ?? true,
      isActive: editing?.isActive ?? true
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      editing ? leaveTypesApi.update(editing.id, values) : leaveTypesApi.create(values),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave type saved") });
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      onClose();
    },
    onError: showError
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? tx("Edit leave type") : tx("New leave type")}
    >
      <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
        <Stack>
          <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
          <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
          <NumberInput label={tx("Annual allowance")} min={0} {...form.getInputProps("annualAllowance")} />
          <Switch
            label={tx("Paid leave")}
            description={tx("Counted as a paid work day")}
            {...form.getInputProps("isPaid", { type: "checkbox" })}
          />
          <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
          <Button type="submit" loading={saveMutation.isPending}>
            {tx("Save")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

type LeaveTypesListModalProps = {
  opened: boolean;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (leaveType: LeaveType) => void;
};

export function LeaveTypesListModal({ opened, onClose, onCreate, onEdit }: LeaveTypesListModalProps) {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["leave-types"],
    queryFn: leaveTypesApi.list,
    enabled: opened
  });
  const disableMutation = useMutation({
    mutationFn: leaveTypesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: showError
  });

  return (
    <Modal opened={opened} onClose={onClose} title={tx("Leave types")} size="xl">
      <Stack>
        <PermissionGate permissions={["LEAVE_TYPE_CREATE"]}>
          <Group justify="flex-end">
            <Button leftSection={<Plus size={16} />} onClick={onCreate}>
              {tx("New leave type")}
            </Button>
          </Group>
        </PermissionGate>
        <DataTable<LeaveType>
          data={query.data ?? []}
          loading={query.isLoading}
          error={query.error ? getApiErrorMessage(query.error) : null}
          tableMinWidth={640}
          rowKey={(item) => item.id}
          columns={[
            { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.code}</Text> },
            { key: "name", label: "Name", render: (item) => item.name },
            { key: "allowance", label: "Annual allowance", render: (item) => item.annualAllowance ?? "-" },
            { key: "paid", label: "Paid leave", render: (item) => (item.isPaid ? tx("Yes") : tx("No")) },
            { key: "active", label: "Active", render: (item) => (item.isActive ? tx("Yes") : tx("No")) },
            {
              key: "actions",
              label: "",
              render: (item) => (
                <Group justify="flex-end" gap={4} wrap="nowrap">
                  <Tooltip label={tx("Edit")}>
                    <ActionIcon variant="subtle" onClick={() => onEdit(item)}>
                      <Edit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={tx("Disable")}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        openConfirmModal({
                          title: tx("Disable leave type"),
                          message: `${tx("Disable")} ${item.name}?`,
                          confirmLabel: tx("Disable"),
                          onConfirm: () => disableMutation.mutate(item.id)
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )
            }
          ]}
        />
      </Stack>
    </Modal>
  );
}
