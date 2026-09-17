import {
  ActionIcon,
  Alert,
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
  Title,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Eye,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { payrollApi } from "../../api/endpoints";
import {
  formatDateTime,
  formatDays,
  formatMoney,
  formatMonthYear,
  monthOptions,
  yearOptions
} from "../../api/format";
import type { PayrollPeriod, Payslip } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PermissionGate } from "../../components/PermissionGate";
import { StatCard } from "../../components/StatCard";
import { useTranslation } from "../../i18n";
import { PayslipModal } from "./PayslipModal";

type SendPayload = { employeeIds?: number[]; onlyUnsent?: boolean };

export function PayrollPeriodsPanel() {
  const { tx, te } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpened, setCreateOpened] = useState(false);
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const [search, setSearch] = useState("");
  const form = useForm({
    initialValues: {
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear())
    }
  });

  const periodsQuery = useQuery({
    queryKey: ["payroll-periods"],
    queryFn: payrollApi.periods
  });
  const activeId = selectedId ?? periodsQuery.data?.[0]?.id ?? null;
  const periodQuery = useQuery({
    queryKey: ["payroll-period", activeId],
    queryFn: () => payrollApi.period(activeId as number),
    enabled: activeId !== null
  });
  const period = periodQuery.data;

  function showError(error: unknown) {
    notifications.show({ color: "red", message: getApiErrorMessage(error) });
  }

  function storePeriod(next: PayrollPeriod) {
    queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    queryClient.setQueryData(["payroll-period", next.id], next);
  }

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      payrollApi.createPeriod({ year: Number(values.year), month: Number(values.month) }),
    onSuccess: (next) => {
      storePeriod(next);
      setSelectedId(next.id);
      setCreateOpened(false);
      notifications.show({ color: "green", message: tx("Payroll calculated") });
    },
    onError: showError
  });
  const calculateMutation = useMutation({
    mutationFn: payrollApi.calculate,
    onSuccess: (next) => {
      storePeriod(next);
      notifications.show({ color: "green", message: tx("Payroll calculated") });
    },
    onError: showError
  });
  const finalizeMutation = useMutation({
    mutationFn: payrollApi.finalize,
    onSuccess: (next) => {
      storePeriod(next);
      notifications.show({ color: "green", message: tx("Payroll finalized") });
    },
    onError: showError
  });
  const removeMutation = useMutation({
    mutationFn: payrollApi.removePeriod,
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      notifications.show({ color: "green", message: tx("Payroll period deleted") });
    },
    onError: showError
  });
  const sendMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SendPayload }) =>
      payrollApi.sendPayslips(id, payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-period", variables.id] });
      notifications.show({
        color: result.failed ? "yellow" : "green",
        message: result.failed
          ? `${tx("Payslips emailed")}: ${result.sent} · ${tx("Failed to send")}: ${result.failed}`
          : `${tx("Payslips emailed")}: ${result.sent}`
      });
    },
    onError: showError
  });

  const payslips = period?.payslips ?? [];
  const totals = payslips.reduce(
    (sum, payslip) => ({
      net: sum.net + payslip.netSalary,
      insurance: sum.insurance + payslip.insuranceDeduction,
      emailed: sum.emailed + (payslip.emailedAt ? 1 : 0),
      missingCheckOuts: sum.missingCheckOuts + (payslip.missingCheckOuts ? 1 : 0)
    }),
    { net: 0, insurance: 0, emailed: 0, missingCheckOuts: 0 }
  );
  const term = search.trim().toLowerCase();
  const visiblePayslips = term
    ? payslips.filter(
        (payslip) =>
          payslip.employee.fullName.toLowerCase().includes(term) ||
          payslip.employee.employeeCode.toLowerCase().includes(term)
      )
    : payslips;
  const isDraft = period?.status === "DRAFT";

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Select
            label={tx("Payroll period")}
            placeholder={tx("No payroll period yet")}
            data={(periodsQuery.data ?? []).map((item) => ({
              value: String(item.id),
              label: `${formatMonthYear(item)} · ${te(item.status)}`
            }))}
            value={activeId ? String(activeId) : null}
            onChange={(value) => setSelectedId(value ? Number(value) : null)}
            allowDeselect={false}
            w={260}
          />
          <PermissionGate permissions={["PAYROLL_MANAGE"]}>
            <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpened(true)}>
              {tx("New payroll period")}
            </Button>
          </PermissionGate>
        </Group>
      </Paper>

      {period ? (
        <>
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm">
              <Title order={3}>{`${tx("Payroll")} ${formatMonthYear(period)}`}</Title>
              <Badge color={isDraft ? "yellow" : "green"} variant="light">
                {te(period.status)}
              </Badge>
              {period.calculatedAt ? (
                <Text size="sm" c="dimmed">
                  {`${tx("Payroll calculated")}: ${formatDateTime(period.calculatedAt)}`}
                </Text>
              ) : null}
            </Group>
            <PermissionGate permissions={["PAYROLL_MANAGE"]}>
              {isDraft ? (
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<RefreshCw size={16} />}
                    loading={calculateMutation.isPending}
                    onClick={() => calculateMutation.mutate(period.id)}
                  >
                    {tx("Recalculate")}
                  </Button>
                  <Button
                    leftSection={<Lock size={16} />}
                    loading={finalizeMutation.isPending}
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Finalize payroll"),
                        message: tx("Finalized payroll can no longer be recalculated. Continue?"),
                        confirmLabel: tx("Finalize"),
                        onConfirm: () => finalizeMutation.mutate(period.id)
                      })
                    }
                  >
                    {tx("Finalize")}
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={16} />}
                    loading={removeMutation.isPending}
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Delete draft payroll"),
                        message: `${tx("Delete draft payroll")} ${formatMonthYear(period)}?`,
                        confirmLabel: tx("Delete draft"),
                        onConfirm: () => removeMutation.mutate(period.id)
                      })
                    }
                  >
                    {tx("Delete draft")}
                  </Button>
                </Group>
              ) : (
                <Group gap="xs">
                  <Button
                    leftSection={<Send size={16} />}
                    loading={sendMutation.isPending}
                    onClick={() =>
                      sendMutation.mutate({ id: period.id, payload: { onlyUnsent: true } })
                    }
                  >
                    {tx("Email unsent payslips")}
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<Mail size={16} />}
                    disabled={sendMutation.isPending}
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Resend all payslips"),
                        message: tx(
                          "Every employee in this period will receive their payslip again. Continue?"
                        ),
                        confirmLabel: tx("Resend all payslips"),
                        onConfirm: () => sendMutation.mutate({ id: period.id, payload: {} })
                      })
                    }
                  >
                    {tx("Resend all payslips")}
                  </Button>
                </Group>
              )}
            </PermissionGate>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <StatCard label="Payslips" value={payslips.length} icon={Users} color="blue" />
            <StatCard label="Total net pay" value={formatMoney(totals.net)} icon={Banknote} color="green" />
            <StatCard label="Total insurance" value={formatMoney(totals.insurance)} icon={ShieldCheck} color="grape" />
            <StatCard label="Emailed" value={`${totals.emailed}/${payslips.length}`} icon={Mail} color="cyan" />
          </SimpleGrid>

          {isDraft ? (
            <Alert color="blue" variant="light">
              {tx("Draft payroll can be recalculated. Finalize it before emailing payslips.")}
            </Alert>
          ) : null}
          {isDraft && totals.missingCheckOuts ? (
            <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />}>
              {`${totals.missingCheckOuts} ${tx(
                "employees have check-ins without a check-out. Adjust attendance and recalculate before finalizing."
              )}`}
            </Alert>
          ) : null}

          <TextInput
            placeholder={tx("Search employee")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            maw={320}
          />
          <DataTable<Payslip>
            data={visiblePayslips}
            loading={periodQuery.isLoading}
            error={periodQuery.error ? getApiErrorMessage(periodQuery.error) : null}
            rowKey={(item) => item.id}
            tableMinWidth={1250}
            columns={[
              {
                key: "employee",
                label: "Employee",
                render: (item) => (
                  <Stack gap={0}>
                    <Text fw={700}>{item.employee.fullName}</Text>
                    <Text size="xs" c="dimmed">
                      {`${item.employee.employeeCode} · ${item.employee.department?.name ?? "-"}`}
                    </Text>
                  </Stack>
                )
              },
              {
                key: "days",
                label: "Payable days",
                render: (item) => (
                  <Stack gap={0}>
                    <Text size="sm">{`${formatDays(item.payableDays)} / ${formatDays(item.standardWorkDays)}`}</Text>
                    {item.missingCheckOuts ? (
                      <Text size="xs" c="yellow.8">
                        {`${item.missingCheckOuts} ${tx("Missing check-outs")}`}
                      </Text>
                    ) : null}
                  </Stack>
                )
              },
              { key: "gross", label: "Salary by work days", render: (item) => formatMoney(item.grossSalary) },
              { key: "allowance", label: "Allowance", render: (item) => formatMoney(item.allowance) },
              { key: "overtime", label: "Overtime pay", render: (item) => formatMoney(item.overtimePay) },
              {
                key: "deduction",
                label: "Late/early deduction",
                render: (item) =>
                  item.attendanceDeduction ? (
                    <Text size="sm" c="red">{`-${formatMoney(item.attendanceDeduction)}`}</Text>
                  ) : (
                    formatMoney(0)
                  )
              },
              { key: "insurance", label: "Insurance", render: (item) => `-${formatMoney(item.insuranceDeduction)}` },
              { key: "net", label: "Net pay", render: (item) => <Text fw={800}>{formatMoney(item.netSalary)}</Text> },
              {
                key: "email",
                label: "Email",
                render: (item) =>
                  item.emailedAt ? (
                    <Tooltip label={formatDateTime(item.emailedAt)}>
                      <Badge color="green" variant="light">{tx("Sent")}</Badge>
                    </Tooltip>
                  ) : item.emailError ? (
                    <Tooltip label={item.emailError} multiline w={280}>
                      <Badge color="red" variant="light">{tx("Failed")}</Badge>
                    </Tooltip>
                  ) : (
                    <Badge color="gray" variant="light">{tx("Not sent")}</Badge>
                  )
              },
              {
                key: "actions",
                label: "",
                render: (item) => (
                  <Group justify="flex-end" gap={4} wrap="nowrap">
                    <Tooltip label={tx("View payslip")}>
                      <ActionIcon variant="subtle" onClick={() => setViewing(item)}>
                        <Eye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {!isDraft ? (
                      <PermissionGate permissions={["PAYROLL_MANAGE"]}>
                        <Tooltip label={tx("Resend payslip")}>
                          <ActionIcon
                            variant="subtle"
                            disabled={sendMutation.isPending}
                            onClick={() =>
                              sendMutation.mutate({
                                id: item.periodId,
                                payload: { employeeIds: [item.employeeId] }
                              })
                            }
                          >
                            <Send size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </PermissionGate>
                    ) : null}
                  </Group>
                )
              }
            ]}
          />
        </>
      ) : periodsQuery.isLoading || periodQuery.isLoading ? null : (
        <Paper withBorder radius="md" p="xl">
          <Text c="dimmed" ta="center">
            {tx("No payroll period yet")}
          </Text>
        </Paper>
      )}

      <Modal opened={createOpened} onClose={() => setCreateOpened(false)} title={tx("New payroll period")}>
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <Group grow>
              <Select
                label={tx("Month")}
                data={monthOptions(tx("Month"))}
                allowDeselect={false}
                {...form.getInputProps("month")}
              />
              <Select
                label={tx("Year")}
                data={yearOptions()}
                allowDeselect={false}
                {...form.getInputProps("year")}
              />
            </Group>
            <Text size="sm" c="dimmed">
              {tx("Employees without a salary are skipped when payroll is calculated.")}
            </Text>
            <Button type="submit" loading={createMutation.isPending}>
              {tx("Create and calculate")}
            </Button>
          </Stack>
        </form>
      </Modal>
      <PayslipModal payslip={viewing} period={period} onClose={() => setViewing(null)} />
    </Stack>
  );
}
