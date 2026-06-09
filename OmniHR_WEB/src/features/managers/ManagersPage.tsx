import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2Off, Plus } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { employeesApi, managersApi } from "../../api/endpoints";
import { formatDate } from "../../api/format";
import type { EmployeeManager } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function ManagersPage() {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const query = useQuery({ queryKey: ["managers"], queryFn: managersApi.list });
  const employeesQuery = useQuery({ queryKey: ["employees-for-managers"], queryFn: () => employeesApi.list({ limit: 200 }) });
  const form = useForm({ initialValues: { employeeId: "", managerId: "", managerType: "DIRECT", startDate: "" } });

  const assignMutation = useMutation({
    mutationFn: (values: typeof form.values) => managersApi.assign({
      employeeId: Number(values.employeeId),
      managerId: Number(values.managerId),
      managerType: values.managerType,
      startDate: values.startDate || undefined
    }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Manager assigned") });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const endMutation = useMutation({
    mutationFn: (id: number) => managersApi.end(id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["managers"] })
  });

  const employeeOptions = (employeesQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.employeeCode} - ${item.fullName}`
  }));

  return (
    <Stack gap="md">
      <PageHeader title="Managers" description="Assign direct or project managers." actions={<Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>{tx("Assign manager")}</Button>} />
      <DataTable<EmployeeManager>
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "employee", label: "Employee", render: (item) => <Text fw={700}>{item.employee.fullName}</Text> },
          { key: "manager", label: "Manager", render: (item) => item.manager.fullName },
          { key: "type", label: "Type", render: (item) => <Badge>{te(item.managerType)}</Badge> },
          { key: "start", label: "Start", render: (item) => formatDate(item.startDate) },
          { key: "active", label: "Active", render: (item) => item.isActive ? tx("Yes") : tx("No") },
          { key: "actions", label: "", render: (item) => item.isActive ? (
            <Group justify="flex-end"><Tooltip label={tx("End relationship")}><ActionIcon color="red" variant="subtle" onClick={() => endMutation.mutate(item.id)}><Link2Off size={16} /></ActionIcon></Tooltip></Group>
          ) : null }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={tx("Assign manager")}>
        <form onSubmit={form.onSubmit((values) => assignMutation.mutate(values))}>
          <Stack>
            <Select label={tx("Employee")} data={employeeOptions} required {...form.getInputProps("employeeId")} />
            <Select label={tx("Manager")} data={employeeOptions} required {...form.getInputProps("managerId")} />
            <Select label={tx("Manager type")} data={["DIRECT", "PROJECT"].map((value) => ({ value, label: te(value) }))} {...form.getInputProps("managerType")} />
            <TextInput label={tx("Start date")} type="date" {...form.getInputProps("startDate")} />
            <Button type="submit" loading={assignMutation.isPending}>{tx("Assign")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
