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
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, KeyRound, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, employeesApi, positionsApi } from "../../api/endpoints";
import { formatDate, statusColor } from "../../api/format";
import type { Employee, EmployeeCreateResult } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

type EmployeesPageProps = {
  scope: "all" | "team";
};

export function EmployeesPage({ scope }: EmployeesPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [defaultPassword, setDefaultPassword] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["employees", scope, search],
    queryFn: () =>
      scope === "team"
        ? employeesApi.team({ search, limit: 50 })
        : employeesApi.list({ search, limit: 50 })
  });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: () => departmentsApi.list() });
  const positionsQuery = useQuery({ queryKey: ["positions"], queryFn: () => positionsApi.list() });

  const form = useForm({
    initialValues: {
      employeeCode: "",
      fullName: "",
      companyEmail: "",
      personalEmail: "",
      phone: "",
      birthDate: "",
      hireDate: "",
      status: "ACTIVE",
      departmentId: "",
      positionId: ""
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizeEmployeePayload(values);
      return editing
        ? employeesApi.update(editing.id, payload)
        : employeesApi.create(payload);
    },
    onSuccess: (result: Employee | EmployeeCreateResult) => {
      notifications.show({ color: "green", message: tx("Employee saved") });
      if ("defaultPassword" in result) {
        setDefaultPassword(result.defaultPassword);
      }
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const removeMutation = useMutation({
    mutationFn: employeesApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Employee disabled") });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const resetMutation = useMutation({
    mutationFn: employeesApi.resetPassword,
    onSuccess: (result) => {
      setDefaultPassword(result.defaultPassword);
      notifications.show({ color: "green", message: tx("Password reset") });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const userStatusMutation = useMutation({
    mutationFn: (values: { id: number; active: boolean }) =>
      values.active
        ? employeesApi.lockUser(values.id)
        : employeesApi.unlockUser(values.id),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("User status updated") });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.reset();
    form.setFieldValue("status", "ACTIVE");
    setOpened(true);
  }

  function openEdit(item: Employee) {
    setEditing(item);
    form.setValues({
      employeeCode: item.employeeCode,
      fullName: item.fullName,
      companyEmail: item.companyEmail,
      personalEmail: item.personalEmail ?? "",
      phone: item.phone ?? "",
      birthDate: item.birthDate?.slice(0, 10) ?? "",
      hireDate: item.hireDate?.slice(0, 10) ?? "",
      status: item.status,
      departmentId: item.department?.id ? String(item.department.id) : "",
      positionId: item.position?.id ? String(item.position.id) : ""
    });
    setOpened(true);
  }

  const departmentOptions = (departmentsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name
  }));
  const positionOptions = (positionsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "My Team" : "Employees"}
        description={
          scope === "team"
            ? "Browse direct and project subordinates within your manager scope."
            : "Manage employees and their system accounts."
        }
        actions={
          scope === "all" ? (
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>
              {tx("New employee")}
            </Button>
          ) : null
        }
      />

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <TextInput
          placeholder={tx("Search by name, code, or email")}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </Paper>

      <DataTable<Employee>
        data={employeesQuery.data?.items ?? []}
        loading={employeesQuery.isLoading}
        error={employeesQuery.error ? getApiErrorMessage(employeesQuery.error) : null}
        total={employeesQuery.data?.meta.total}
        limit={employeesQuery.data?.meta.limit}
        page={employeesQuery.data?.meta.page}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.employeeCode}</Text> },
          { key: "name", label: "Name", render: (item) => <Stack gap={0}><Text fw={700}>{item.fullName}</Text><Text size="xs" c="dimmed">{item.companyEmail}</Text></Stack> },
          { key: "department", label: "Department", render: (item) => item.department?.name ?? "-" },
          { key: "position", label: "Position", render: (item) => item.position?.name ?? "-" },
          { key: "birthDate", label: "Birth date", render: (item) => formatDate(item.birthDate) },
          { key: "status", label: "Status", render: (item) => <Badge color={statusColor(item.status)}>{te(item.status)}</Badge> },
          {
            key: "actions",
            label: "",
            render: (item) =>
              scope === "all" ? (
                <Group justify="flex-end" gap={4}>
                  <Tooltip label={tx("Edit")}><ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon></Tooltip>
                  <Tooltip label={tx("Reset password")}><ActionIcon variant="subtle" color="yellow" onClick={() => resetMutation.mutate(item.id)}><KeyRound size={16} /></ActionIcon></Tooltip>
                  <Tooltip label={item.user?.isActive ? tx("Lock user") : tx("Unlock user")}>
                    <ActionIcon
                      variant="subtle"
                      color={item.user?.isActive ? "orange" : "green"}
                      loading={userStatusMutation.isPending}
                      onClick={() => userStatusMutation.mutate({ id: item.id, active: Boolean(item.user?.isActive) })}
                    >
                      {item.user?.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={tx("Disable employee")}>
                    <ActionIcon variant="subtle" color="red" onClick={() => openConfirmModal({ title: tx("Disable employee"), message: `${tx("Disable")} ${item.fullName}?`, confirmLabel: tx("Disable"), onConfirm: () => removeMutation.mutate(item.id) })}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ) : null
          }
        ]}
      />

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit employee") : tx("New employee")} size="lg">
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label={tx("Employee code")} required {...form.getInputProps("employeeCode")} />
              <TextInput label={tx("Full name")} required {...form.getInputProps("fullName")} />
              <TextInput label={tx("Company email")} required {...form.getInputProps("companyEmail")} />
              <TextInput label={tx("Personal email")} {...form.getInputProps("personalEmail")} />
              <TextInput label={tx("Phone")} {...form.getInputProps("phone")} />
              <TextInput label={tx("Birth date")} type="date" required {...form.getInputProps("birthDate")} />
              <TextInput label={tx("Hire date")} type="date" {...form.getInputProps("hireDate")} />
              <Select label={tx("Status")} data={["ACTIVE", "INACTIVE", "TERMINATED"].map((value) => ({ value, label: te(value) }))} {...form.getInputProps("status")} />
              <Select label={tx("Department")} data={departmentOptions} clearable {...form.getInputProps("departmentId")} />
              <Select label={tx("Position")} data={positionOptions} clearable {...form.getInputProps("positionId")} />
            </SimpleGrid>
            <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={Boolean(defaultPassword)} onClose={() => setDefaultPassword(null)} title={tx("Default password")}>
        <Stack>
          <Text>{tx("This password is shown once for admin handoff.")}</Text>
          <Paper withBorder radius="md" p="md">
            <Text fw={800} fz="xl">{defaultPassword}</Text>
          </Paper>
          <Button onClick={() => setDefaultPassword(null)}>{tx("Done")}</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function normalizeEmployeePayload(values: Record<string, string>) {
  return {
    ...values,
    departmentId: values.departmentId ? Number(values.departmentId) : undefined,
    positionId: values.positionId ? Number(values.positionId) : undefined,
    hireDate: values.hireDate || undefined,
    personalEmail: values.personalEmail || undefined,
    phone: values.phone || undefined
  };
}
