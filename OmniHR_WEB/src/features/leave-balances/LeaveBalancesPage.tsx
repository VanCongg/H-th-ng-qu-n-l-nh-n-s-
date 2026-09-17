import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, CalendarX, ListChecks, Plus, Users } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { departmentsApi, leaveBalancesApi } from "../../api/endpoints";
import { formatDate, formatDays, yearOptions } from "../../api/format";
import type { LeaveBalanceRow, LeaveBalanceStatus, LeaveType } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { PermissionGate } from "../../components/PermissionGate";
import { StatCard } from "../../components/StatCard";
import { useTranslation } from "../../i18n";
import { LeaveTypeFormModal, LeaveTypesListModal } from "../leave-types/LeaveTypeModals";

const balanceColors: Record<LeaveBalanceStatus, string> = {
  AVAILABLE: "green",
  LOW: "yellow",
  EXHAUSTED: "red"
};

export function LeaveBalancesPage() {
  const { tx } = useTranslation();
  const [typesOpened, setTypesOpened] = useState(false);
  const [typeForm, setTypeForm] = useState<{ key: number; opened: boolean; editing: LeaveType | null }>(
    { key: 0, opened: false, editing: null }
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [balance, setBalance] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("code");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["leave-balances", year, departmentId, debouncedSearch, balance, sortBy, page],
    queryFn: () =>
      leaveBalancesApi.list({
        year,
        departmentId: departmentId ? Number(departmentId) : undefined,
        search: debouncedSearch || undefined,
        balance: balance ?? undefined,
        sortBy,
        page,
        limit: 20
      }),
    placeholderData: keepPreviousData
  });
  const departmentsQuery = useQuery({
    queryKey: ["leave-balance-departments"],
    queryFn: () => departmentsApi.list()
  });
  const departmentOptions = (departmentsQuery.data ?? []).map((department) => ({
    value: String(department.id),
    label: department.name
  }));
  const summary = query.data?.summary;

  function openTypeForm(editing: LeaveType | null) {
    setTypeForm((current) => ({ key: current.key + 1, opened: true, editing }));
  }

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Leave"
        description="Track each employee's annual leave balance and manage leave types."
        actions={
          <>
            <Button
              variant="light"
              leftSection={<ListChecks size={16} />}
              onClick={() => setTypesOpened(true)}
            >
              {tx("Leave types")}
            </Button>
            <PermissionGate permissions={["LEAVE_TYPE_CREATE"]}>
              <Button leftSection={<Plus size={16} />} onClick={() => openTypeForm(null)}>
                {tx("New leave type")}
              </Button>
            </PermissionGate>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard label="Employees" value={summary?.totalEmployees ?? 0} icon={Users} color="blue" />
        <StatCard
          label="Annual leave per year"
          value={`${summary?.annualAllowance ?? 0} ${tx("days")}`}
          icon={CalendarCheck}
          color="teal"
        />
        <StatCard label="Low balance" value={summary?.lowCount ?? 0} icon={AlertTriangle} color="yellow" />
        <StatCard label="Out of leave" value={summary?.exhaustedCount ?? 0} icon={CalendarX} color="red" />
      </SimpleGrid>

      {summary && !summary.annualLeaveTypeConfigured ? (
        <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />}>
          {tx("The ANNUAL_LEAVE leave type is missing or inactive, so no annual leave usage is counted.")}
        </Alert>
      ) : null}
      {summary?.missingHireDateCount ? (
        <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />}>
          {`${summary.missingHireDateCount} ${tx(
            "employees have no hire date; their leave accrues from the start of the year and earns no seniority days."
          )}`}
        </Alert>
      ) : null}
      {summary ? (
        <Text size="sm" c="dimmed">
          {[
            tx("Annual leave accrues for each full month worked, prorated from the yearly allowance."),
            summary.seniorityEveryYears
              ? tx("One extra day for every {years} full years of service.").replace(
                  "{years}",
                  String(summary.seniorityEveryYears)
                )
              : null,
            summary.carryOverMaxDays
              ? tx("Up to {days} unused days carry over to the next year.").replace(
                  "{days}",
                  String(summary.carryOverMaxDays)
                )
              : null,
            `${tx("As of")} ${formatDate(summary.asOf)}.`
          ]
            .filter(Boolean)
            .join(" ")}
        </Text>
      ) : null}

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label={tx("Search employee")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            w={240}
          />
          <Select
            label={tx("Department")}
            placeholder={tx("All departments")}
            data={departmentOptions}
            clearable
            value={departmentId}
            onChange={resetPage(setDepartmentId)}
            w={220}
          />
          <Select
            label={tx("Year")}
            data={yearOptions()}
            value={String(year)}
            allowDeselect={false}
            onChange={(value) => {
              setYear(Number(value));
              setPage(1);
            }}
            w={120}
          />
          <Select
            label={tx("Leave balance")}
            placeholder={tx("All balances")}
            data={[
              { value: "AVAILABLE", label: tx("More than 2 days left") },
              { value: "LOW", label: tx("2 days or fewer left") },
              { value: "EXHAUSTED", label: tx("No leave left") }
            ]}
            clearable
            value={balance}
            onChange={resetPage(setBalance)}
            w={220}
          />
          <Select
            label={tx("Sort by")}
            data={[
              { value: "code", label: tx("Employee code") },
              { value: "remainingAsc", label: tx("Fewest days left") },
              { value: "remainingDesc", label: tx("Most days left") }
            ]}
            value={sortBy}
            allowDeselect={false}
            onChange={(value) => {
              setSortBy(value ?? "code");
              setPage(1);
            }}
            w={200}
          />
        </Group>
      </Paper>

      <DataTable<LeaveBalanceRow>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        rowKey={(item) => item.employee.id}
        tableMinWidth={1150}
        columns={[
          {
            key: "employee",
            label: "Employee",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.employee.fullName}</Text>
                <Text size="xs" c="dimmed">
                  {item.employee.employeeCode}
                </Text>
              </Stack>
            )
          },
          { key: "department", label: "Department", render: (item) => item.employee.department?.name ?? "-" },
          {
            key: "hireDate",
            label: "Hire date",
            render: (item) =>
              item.hireDateMissing ? (
                <Badge color="red" variant="light">
                  {tx("Missing")}
                </Badge>
              ) : (
                formatDate(item.employee.hireDate)
              )
          },
          { key: "months", label: "Full months worked", render: (item) => item.monthsWorked },
          {
            key: "earned",
            label: "Earned",
            render: (item) => (
              <Stack gap={0}>
                <Text size="sm">{`${formatDays(item.accruedDays)} / ${formatDays(item.entitlementDays)}`}</Text>
                {item.seniorityDays ? (
                  <Text size="xs" c="teal.7">
                    {`+${formatDays(item.seniorityDays)} ${tx("seniority")}`}
                  </Text>
                ) : null}
              </Stack>
            )
          },
          {
            key: "carried",
            label: "Carried over",
            render: (item) =>
              item.carriedOverDays ? formatDays(item.carriedOverDays) : <Text size="sm" c="dimmed">0</Text>
          },
          { key: "used", label: "Used", render: (item) => formatDays(item.usedDays) },
          {
            key: "pending",
            label: "Pending approval",
            render: (item) =>
              item.pendingDays ? formatDays(item.pendingDays) : <Text size="sm" c="dimmed">0</Text>
          },
          {
            key: "remaining",
            label: "Remaining",
            render: (item) => (
              <Badge color={balanceColors[item.status]} variant="light" size="lg">
                {formatDays(item.remainingDays)}
              </Badge>
            )
          },
          { key: "available", label: "Can still request", render: (item) => formatDays(item.availableDays) }
        ]}
      />

      <LeaveTypesListModal
        opened={typesOpened}
        onClose={() => setTypesOpened(false)}
        onCreate={() => openTypeForm(null)}
        onEdit={(leaveType) => openTypeForm(leaveType)}
      />
      <LeaveTypeFormModal
        key={typeForm.key}
        opened={typeForm.opened}
        editing={typeForm.editing}
        onClose={() => setTypeForm((current) => ({ ...current, opened: false }))}
      />
    </Stack>
  );
}
