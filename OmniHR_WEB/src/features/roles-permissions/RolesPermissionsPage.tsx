import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, KeyRound, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { permissionsApi, rolesApi } from "../../api/endpoints";
import type { Role } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

function PermissionChips({ role }: { role: Role }) {
  const permissions = role.rolePermissions?.map((item) => item.permission) ?? [];
  const visiblePermissions = permissions.slice(0, 8);
  const hiddenPermissions = permissions.slice(8);

  if (!permissions.length) {
    return <Text c="dimmed">-</Text>;
  }

  return (
    <Group gap={6} className="permission-chip-row">
      {visiblePermissions.map((permission) => (
        <Badge key={permission.id} size="sm" variant="light" className="permission-chip">
          {permission.code}
        </Badge>
      ))}
      {hiddenPermissions.length ? (
        <Tooltip
          label={hiddenPermissions.map((permission) => permission.code).join(", ")}
          multiline
          w={320}
        >
          <Badge size="sm" color="gray" variant="outline" className="permission-chip">
            +{hiddenPermissions.length}
          </Badge>
        </Tooltip>
      ) : null}
    </Group>
  );
}

export function RolesPermissionsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list });
  const form = useForm({ initialValues: { name: "", description: "", permissionIds: [] as string[] } });
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const totalRolePermissions = roles.reduce(
    (total, role) => total + (role.rolePermissions?.length ?? 0),
    0
  );

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

  const permissionOptions = permissions.map((item) => ({
    value: String(item.id),
    label: item.description ? `${item.code} - ${item.description}` : item.code
  }));

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
      <PageHeader
        title="Roles & Permissions"
        description="View seeded permissions and manage role mappings."
        actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New role")}</Button>}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder radius="md" p="md" className="admin-mini-card">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">{tx("Roles")}</Text>
              <Text fw={800} size="xl">{roles.length}</Text>
            </Stack>
            <ThemeIcon radius="md" size="lg" variant="light" color="blue">
              <ShieldCheck size={18} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper withBorder radius="md" p="md" className="admin-mini-card">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">{tx("Permissions")}</Text>
              <Text fw={800} size="xl">{permissions.length}</Text>
            </Stack>
            <ThemeIcon radius="md" size="lg" variant="light" color="teal">
              <KeyRound size={18} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper withBorder radius="md" p="md" className="admin-mini-card">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">{tx("Role")} / {tx("Permissions")}</Text>
              <Text fw={800} size="xl">{totalRolePermissions}</Text>
            </Stack>
            <ThemeIcon radius="md" size="lg" variant="light" color="yellow">
              <Users size={18} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>
      <DataTable<Role>
        className="role-permission-table"
        tableMinWidth={980}
        rowKey={(item) => item.id}
        data={roles}
        loading={rolesQuery.isLoading}
        error={rolesQuery.error ? getApiErrorMessage(rolesQuery.error) : null}
        columns={[
          {
            key: "name",
            label: "Role",
            width: 320,
            render: (item) => (
              <Group gap="sm" wrap="nowrap" align="flex-start" className="role-identity">
                <ThemeIcon radius="md" size="lg" variant="light" color={item.isSystem ? "blue" : "gray"}>
                  <ShieldCheck size={18} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text fw={800}>{item.name}</Text>
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {item.description ?? "-"}
                  </Text>
                </Stack>
              </Group>
            )
          },
          {
            key: "users",
            label: "Employees",
            width: 140,
            render: (item) => (
              <Badge variant="light" color="teal" leftSection={<Users size={12} />}>
                {item._count?.userRoles ?? 0}
              </Badge>
            )
          },
          {
            key: "system",
            label: "System",
            width: 130,
            render: (item) => (
              <Badge color={item.isSystem ? "blue" : "gray"} variant={item.isSystem ? "light" : "outline"}>
                {item.isSystem ? tx("Yes") : tx("No")}
              </Badge>
            )
          },
          {
            key: "permissions",
            label: "Permissions",
            render: (item) => <PermissionChips role={item} />
          },
          {
            key: "actions",
            label: "",
            width: 72,
            render: (item) => (
              <Group justify="flex-end">
                <Tooltip label={tx("Edit")}>
                  <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                    <Edit size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit role") : tx("New role")} size="lg">
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <TextInput label={tx("Description")} {...form.getInputProps("description")} />
            <MultiSelect
              label={tx("Permissions")}
              data={permissionOptions}
              searchable
              maxDropdownHeight={320}
              nothingFoundMessage={tx("No records")}
              {...form.getInputProps("permissionIds")}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setOpened(false)}>{tx("Cancel")}</Button>
              <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
