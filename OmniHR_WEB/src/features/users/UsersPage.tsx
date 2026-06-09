import { ActionIcon, Badge, Button, Group, Modal, MultiSelect, PasswordInput, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { rolesApi, usersApi } from "../../api/endpoints";
import type { UserSummary } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function UsersPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const query = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list({ limit: 100 }) });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const form = useForm({ initialValues: { username: "", email: "", password: "", isActive: true, mustChangePassword: true, roleIds: [] as string[] } });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload: Record<string, unknown> = {
        username: values.username,
        email: values.email,
        isActive: values.isActive,
        mustChangePassword: values.mustChangePassword,
        roleIds: values.roleIds.map(Number)
      };
      if (values.password) payload.password = values.password;
      return editing ? usersApi.update(editing.id, payload) : usersApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("User saved") });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({ mutationFn: usersApi.remove, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }) });
  const resetMutation = useMutation({
    mutationFn: (id: number) => usersApi.resetPassword(id, { password: "Admin@123456", mustChangePassword: true }),
    onSuccess: () => notifications.show({ color: "green", message: tx("Password reset to Admin@123456") })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({ username: "", email: "", password: "", isActive: true, mustChangePassword: true, roleIds: [] });
    setOpened(true);
  }
  function openEdit(item: UserSummary) {
    setEditing(item);
    form.setValues({
      username: item.username,
      email: item.email,
      password: "",
      isActive: item.isActive,
      mustChangePassword: item.mustChangePassword,
      roleIds: item.userRoles?.map((role) => String(role.role.id)) ?? []
    });
    setOpened(true);
  }

  const roleOptions = (rolesQuery.data ?? []).map((role) => ({ value: String(role.id), label: role.name }));

  return (
    <Stack gap="md">
      <PageHeader title="Users" description="Manage accounts, lock state, and role assignment." actions={<Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New user")}</Button>} />
      <DataTable<UserSummary>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "username", label: "Username", render: (item) => <Text fw={700}>{item.username}</Text> },
          { key: "email", label: "Email", render: (item) => item.email },
          { key: "roles", label: "Roles", render: (item) => <Group gap={4}>{item.userRoles?.map((r) => <Badge key={r.role.id}>{r.role.name}</Badge>)}</Group> },
          { key: "active", label: "Active", render: (item) => item.isActive ? tx("Yes") : tx("No") },
          { key: "must", label: "Must change password", render: (item) => item.mustChangePassword ? tx("Yes") : tx("No") },
          { key: "actions", label: "", render: (item) => (
            <Group justify="flex-end" gap={4}>
              <Tooltip label={tx("Edit")}><ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Reset password")}><ActionIcon color="yellow" variant="subtle" onClick={() => resetMutation.mutate(item.id)}><KeyRound size={16} /></ActionIcon></Tooltip>
              <Tooltip label={tx("Disable")}><ActionIcon color="red" variant="subtle" onClick={() => openConfirmModal({ title: tx("Disable user"), message: `${tx("Disable")} ${item.username}?`, confirmLabel: tx("Disable"), onConfirm: () => deleteMutation.mutate(item.id) })}><Trash2 size={16} /></ActionIcon></Tooltip>
            </Group>
          ) }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit user") : tx("New user")}>
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Username")} required {...form.getInputProps("username")} />
            <TextInput label={tx("Email")} required {...form.getInputProps("email")} />
            <PasswordInput label={editing ? tx("New password") : tx("Password")} required={!editing} {...form.getInputProps("password")} />
            <MultiSelect label={tx("Roles")} data={roleOptions} {...form.getInputProps("roleIds")} />
            <Switch label={tx("Active")} {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Switch label={tx("Must change password")} {...form.getInputProps("mustChangePassword", { type: "checkbox" })} />
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
