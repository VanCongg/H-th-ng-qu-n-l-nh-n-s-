import { Badge, Button, Group, Modal, MultiSelect, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { permissionsApi, rolesApi } from "../../api/endpoints";
import type { Role } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function RolesPermissionsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list });
  const form = useForm({ initialValues: { name: "", description: "", permissionIds: [] as string[] } });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = {
        name: values.name,
        description: values.description,
        permissionIds: values.permissionIds.map(Number)
      };
      return editing ? rolesApi.update(editing.id, payload) : rolesApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Role saved") });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const permissionOptions = (permissionsQuery.data ?? []).map((item) => ({ value: String(item.id), label: item.code }));

  function openCreate() {
    setEditing(null);
    form.setValues({ name: "", description: "", permissionIds: [] });
    setOpened(true);
  }
  function openEdit(role: Role) {
    setEditing(role);
    form.setValues({
      name: role.name,
      description: role.description ?? "",
      permissionIds: role.rolePermissions?.map((item) => String(item.permission.id)) ?? []
    });
    setOpened(true);
  }

  return (
    <Stack gap="md">
      <PageHeader title="Roles & Permissions" description="View seeded permissions and manage role mappings." actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New role")}</Button>} />
      <DataTable<Role>
        data={rolesQuery.data ?? []}
        loading={rolesQuery.isLoading}
        error={rolesQuery.error ? getApiErrorMessage(rolesQuery.error) : null}
        columns={[
          { key: "name", label: "Role", render: (item) => <Text fw={700}>{item.name}</Text> },
          { key: "description", label: "Description", render: (item) => item.description ?? "-" },
          { key: "users", label: "Employees", render: (item) => item._count?.userRoles ?? 0 },
          { key: "system", label: "System", render: (item) => item.isSystem ? tx("Yes") : tx("No") },
          { key: "permissions", label: "Permissions", render: (item) => <Group gap={4}>{item.rolePermissions?.slice(0, 6).map((p) => <Badge key={p.permission.id} variant="light">{p.permission.code}</Badge>)}{(item.rolePermissions?.length ?? 0) > 6 ? <Badge color="gray">+{(item.rolePermissions?.length ?? 0) - 6}</Badge> : null}</Group> },
          { key: "actions", label: "", render: (item) => <Group justify="flex-end"><Button size="xs" variant="light" onClick={() => openEdit(item)}>{tx("Edit")}</Button></Group> }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit role") : tx("New role")} size="lg">
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <TextInput label={tx("Description")} {...form.getInputProps("description")} />
            <MultiSelect label={tx("Permissions")} data={permissionOptions} searchable {...form.getInputProps("permissionIds")} />
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
