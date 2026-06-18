import { ActionIcon, Button, Group, Modal, Select, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, employeesApi } from "../../api/endpoints";
import type { Department } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { openConfirmModal } from "../../components/ConfirmModal";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function DepartmentsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const query = useQuery({ queryKey: ["departments"], queryFn: () => departmentsApi.list() });
  const employeesQuery = useQuery({
    queryKey: ["employees", "department-manager-options"],
    queryFn: () => employeesApi.list({ limit: 100 })
  });

  const form = useForm({
    initialValues: { code: "", name: "", managerId: "", isActive: true },
    validate: {
      code: (value) => (value.trim() ? null : tx("Required")),
      name: (value) => (value.trim() ? null : tx("Required"))
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      editing
        ? departmentsApi.update(editing.id, normalizeDepartmentPayload(values))
        : departmentsApi.create(normalizeDepartmentPayload(values)),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Department saved") });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const deleteMutation = useMutation({
    mutationFn: departmentsApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Department disabled") });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({ code: "", name: "", managerId: "", isActive: true });
    setOpened(true);
  }

  function openEdit(item: Department) {
    setEditing(item);
    form.setValues({
      code: item.code,
      name: item.name,
      managerId: item.managerId ? String(item.managerId) : "",
      isActive: item.isActive
    });
    setOpened(true);
  }

  const managerOptions = (employeesQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.fullName} (${item.employeeCode})`
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title="Departments"
        description="Create, update, and soft-delete organization departments."
        actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New department")}</Button>}
      />
      <DataTable<Department>
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.code}</Text> },
          { key: "name", label: "Name", render: (item) => item.name },
          { key: "manager", label: "Manager", render: (item) => item.manager?.fullName ?? "-" },
          { key: "active", label: "Active", render: (item) => item.isActive ? tx("Yes") : tx("No") },
          { key: "employees", label: "Employees", render: (item) => item._count?.employees ?? 0 },
          { key: "teams", label: "Teams", render: (item) => item._count?.teams ?? 0 },
          {
            key: "actions",
            label: "",
            width: 96,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                <Tooltip label={tx("Edit")}>
                  <ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon>
                </Tooltip>
                <Tooltip label={tx("Disable")}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => openConfirmModal({
                      title: tx("Disable department"),
                      message: `${tx("Disable")} ${item.name}?`,
                      confirmLabel: tx("Disable"),
                      onConfirm: () => deleteMutation.mutate(item.id)
                    })}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit department") : tx("New department")}>
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Code")} {...form.getInputProps("code")} />
            <TextInput label={tx("Name")} {...form.getInputProps("name")} />
            <Select
              label={tx("Department manager")}
              data={managerOptions}
              clearable
              searchable
              {...form.getInputProps("managerId")}
            />
            <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function normalizeDepartmentPayload(values: {
  code: string;
  name: string;
  managerId: string;
  isActive: boolean;
}) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    managerId: values.managerId ? Number(values.managerId) : null,
    isActive: values.isActive
  };
}
