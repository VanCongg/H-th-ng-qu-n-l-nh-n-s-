import { ActionIcon, Button, Group, Modal, Select, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, positionsApi } from "../../api/endpoints";
import { formatDepartmentName } from "../../api/format";
import type { Position } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function PositionsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const query = useQuery({ queryKey: ["positions"], queryFn: () => positionsApi.list() });
  const departmentsQuery = useQuery({
    queryKey: ["departments", "position-form"],
    queryFn: () => departmentsApi.list()
  });
  const form = useForm({
    initialValues: { code: "", name: "", departmentId: "", isActive: true },
    validate: {
      departmentId: (value) => (!value ? tx("Required") : null)
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizePositionPayload(values);
      return editing ? positionsApi.update(editing.id, payload) : positionsApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Position saved") });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({
    mutationFn: positionsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions"] })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({ code: "", name: "", departmentId: "", isActive: true });
    setOpened(true);
  }
  function openEdit(item: Position) {
    setEditing(item);
    form.setValues({
      code: item.code,
      name: item.name,
      departmentId: item.departmentId ? String(item.departmentId) : "",
      isActive: item.isActive
    });
    setOpened(true);
  }

  const departmentOptions = (departmentsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: formatDepartmentName(item, tx)
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title="Positions"
        description="Manage job titles."
        actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New position")}</Button>}
      />
      <DataTable<Position>
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.code}</Text> },
          { key: "name", label: "Name", render: (item) => item.name },
          { key: "department", label: "Department", render: (item) => formatDepartmentName(item.department, tx) },
          { key: "employees", label: "Employees", render: (item) => item._count?.employees ?? 0 },
          { key: "active", label: "Active", render: (item) => item.isActive ? tx("Yes") : tx("No") },
          {
            key: "actions",
            label: "",
            render: (item) => (
              <Group justify="flex-end" gap={4}>
                <Tooltip label={tx("Edit")}><ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon></Tooltip>
                <Tooltip label={tx("Disable")}>
                  <ActionIcon variant="subtle" color="red" onClick={() => openConfirmModal({
                    title: tx("Disable position"),
                    message: `${tx("Disable")} ${item.name}?`,
                    confirmLabel: tx("Disable"),
                    onConfirm: () => deleteMutation.mutate(item.id)
                  })}><Trash2 size={16} /></ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit position") : tx("New position")}>
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <Select
              label={tx("Department")}
              data={departmentOptions}
              searchable
              required
              {...form.getInputProps("departmentId")}
            />
            <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function normalizePositionPayload(values: {
  code: string;
  name: string;
  departmentId: string;
  isActive: boolean;
}) {
  return {
    code: values.code,
    name: values.name,
    departmentId: Number(values.departmentId),
    isActive: values.isActive
  };
}
