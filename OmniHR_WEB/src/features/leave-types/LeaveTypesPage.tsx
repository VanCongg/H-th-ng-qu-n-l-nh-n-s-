import { ActionIcon, Button, Group, Modal, NumberInput, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { leaveTypesApi } from "../../api/endpoints";
import type { LeaveType } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function LeaveTypesPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const query = useQuery({ queryKey: ["leave-types"], queryFn: leaveTypesApi.list });
  const form = useForm({ initialValues: { code: "", name: "", annualAllowance: 0, isActive: true } });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      editing ? leaveTypesApi.update(editing.id, values) : leaveTypesApi.create(values),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Leave type saved") });
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({
    mutationFn: leaveTypesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-types"] })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({ code: "", name: "", annualAllowance: 0, isActive: true });
    setOpened(true);
  }
  function openEdit(item: LeaveType) {
    setEditing(item);
    form.setValues({ code: item.code, name: item.name, annualAllowance: item.annualAllowance ?? 0, isActive: item.isActive });
    setOpened(true);
  }

  return (
    <Stack gap="md">
      <PageHeader title="Leave Types" description="Configure leave categories." actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New leave type")}</Button>} />
      <DataTable<LeaveType>
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.code}</Text> },
          { key: "name", label: "Name", render: (item) => item.name },
          { key: "allowance", label: "Annual allowance", render: (item) => item.annualAllowance ?? "-" },
          { key: "active", label: "Active", render: (item) => item.isActive ? tx("Yes") : tx("No") },
          { key: "actions", label: "", render: (item) => (
            <Group justify="flex-end" gap={4}>
              <Tooltip label={tx("Edit")}><ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Disable")}><ActionIcon variant="subtle" color="red" onClick={() => openConfirmModal({ title: tx("Disable leave type"), message: `${tx("Disable")} ${item.name}?`, confirmLabel: tx("Disable"), onConfirm: () => deleteMutation.mutate(item.id) })}><Trash2 size={16} /></ActionIcon></Tooltip>
            </Group>
          ) }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit leave type") : tx("New leave type")}>
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <NumberInput label={tx("Annual allowance")} min={0} {...form.getInputProps("annualAllowance")} />
            <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
