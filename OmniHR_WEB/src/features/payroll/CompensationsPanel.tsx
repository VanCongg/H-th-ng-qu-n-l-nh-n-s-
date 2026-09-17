import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, payrollApi } from "../../api/endpoints";
import { formatMoney } from "../../api/format";
import type { CompensationRow } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PermissionGate } from "../../components/PermissionGate";
import { useTranslation } from "../../i18n";

type SalaryFormValues = {
  baseSalary: number | string;
  allowance: number | string;
  insuranceSalary: number | string;
};

const moneyInputProps = {
  min: 0,
  step: 500_000,
  thousandSeparator: ".",
  decimalSeparator: ",",
  allowDecimal: false,
  suffix: " ₫"
};

export function CompensationsPanel() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CompensationRow | null>(null);
  const form = useForm<SalaryFormValues>({
    initialValues: { baseSalary: "", allowance: 0, insuranceSalary: "" },
    validate: {
      baseSalary: (value) => (value === "" ? tx("Base salary") : null)
    }
  });

  const query = useQuery({
    queryKey: ["payroll-compensations", departmentId, debouncedSearch, page],
    queryFn: () =>
      payrollApi.compensations({
        departmentId: departmentId ? Number(departmentId) : undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 20
      }),
    placeholderData: keepPreviousData
  });
  const departmentsQuery = useQuery({
    queryKey: ["payroll-departments"],
    queryFn: () => departmentsApi.list()
  });
  const departmentOptions = (departmentsQuery.data ?? []).map((department) => ({
    value: String(department.id),
    label: department.name
  }));

  const saveMutation = useMutation({
    mutationFn: ({ employeeId, values }: { employeeId: number; values: SalaryFormValues }) =>
      payrollApi.upsertCompensation(employeeId, {
        baseSalary: Number(values.baseSalary),
        allowance: values.allowance === "" ? 0 : Number(values.allowance),
        insuranceSalary: values.insuranceSalary === "" ? null : Number(values.insuranceSalary)
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Salary saved") });
      queryClient.invalidateQueries({ queryKey: ["payroll-compensations"] });
      setEditing(null);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openEdit(item: CompensationRow) {
    setEditing(item);
    form.setValues({
      baseSalary: item.compensation?.baseSalary ?? "",
      allowance: item.compensation?.allowance ?? 0,
      insuranceSalary: item.compensation?.insuranceSalary ?? ""
    });
  }

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label={tx("Search employee")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            w={260}
          />
          <Select
            label={tx("Department")}
            placeholder={tx("All departments")}
            data={departmentOptions}
            clearable
            value={departmentId}
            onChange={(value) => {
              setDepartmentId(value);
              setPage(1);
            }}
            w={240}
          />
        </Group>
      </Paper>
      <Text size="sm" c="dimmed">
        {tx("Employees without a salary are skipped when payroll is calculated.")}
      </Text>
      <DataTable<CompensationRow>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        rowKey={(item) => item.id}
        columns={[
          {
            key: "employee",
            label: "Employee",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.fullName}</Text>
                <Text size="xs" c="dimmed">
                  {item.employeeCode}
                </Text>
              </Stack>
            )
          },
          { key: "department", label: "Department", render: (item) => item.department?.name ?? "-" },
          { key: "position", label: "Position", render: (item) => item.position?.name ?? "-" },
          {
            key: "base",
            label: "Base salary",
            render: (item) =>
              item.compensation ? (
                <Text fw={700}>{formatMoney(item.compensation.baseSalary)}</Text>
              ) : (
                <Badge color="yellow" variant="light">
                  {tx("Not set")}
                </Badge>
              )
          },
          {
            key: "allowance",
            label: "Allowance",
            render: (item) => (item.compensation ? formatMoney(item.compensation.allowance) : "-")
          },
          {
            key: "insurance",
            label: "Insurance salary",
            render: (item) =>
              !item.compensation ? (
                "-"
              ) : item.compensation.insuranceSalary != null ? (
                formatMoney(item.compensation.insuranceSalary)
              ) : (
                <Text size="sm" c="dimmed">
                  {tx("Same as base salary")}
                </Text>
              )
          },
          {
            key: "actions",
            label: "",
            render: (item) => (
              <PermissionGate permissions={["PAYROLL_MANAGE"]}>
                <Group justify="flex-end">
                  <Tooltip label={tx("Edit salary")}>
                    <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                      <Edit size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </PermissionGate>
            )
          }
        ]}
      />
      <Modal
        opened={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${tx("Edit salary")} · ${editing.fullName}` : tx("Edit salary")}
      >
        <form
          onSubmit={form.onSubmit((values) => {
            if (editing) {
              saveMutation.mutate({ employeeId: editing.id, values });
            }
          })}
        >
          <Stack>
            <NumberInput label={tx("Base salary")} required {...moneyInputProps} {...form.getInputProps("baseSalary")} />
            <NumberInput label={tx("Allowance")} {...moneyInputProps} {...form.getInputProps("allowance")} />
            <NumberInput
              label={tx("Insurance salary")}
              placeholder={tx("Same as base salary")}
              {...moneyInputProps}
              {...form.getInputProps("insuranceSalary")}
            />
            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
