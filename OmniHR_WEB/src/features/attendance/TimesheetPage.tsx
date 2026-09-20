import { ActionIcon, Badge, Group, Paper, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { attendanceApi, departmentsApi } from "../../api/endpoints";
import { formatDays, formatMinutes, monthOptions, yearOptions } from "../../api/format";
import type { TimesheetRow } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function TimesheetPage() {
  const { tx } = useTranslation();
  const navigate = useNavigate();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["timesheets", year, month, departmentId, debouncedSearch, page],
    queryFn: () =>
      attendanceApi.timesheets({
        year,
        month,
        departmentId: departmentId ? Number(departmentId) : undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 20
      }),
    placeholderData: keepPreviousData
  });
  const departmentsQuery = useQuery({
    queryKey: ["timesheet-departments"],
    queryFn: () => departmentsApi.list()
  });
  const departmentOptions = (departmentsQuery.data ?? []).map((department) => ({
    value: String(department.id),
    label: department.name
  }));

  function openRecords(item: TimesheetRow) {
    const params = new URLSearchParams({
      employeeId: String(item.employee.id),
      fromDate: isoDate(year, month, 1),
      toDate: isoDate(year, month, new Date(year, month, 0).getDate())
    });
    navigate(`/admin/attendance?${params.toString()}`);
  }

  function minutesCell(value: number, color: string) {
    return value ? (
      <Text size="sm" c={color} fw={600}>
        {formatMinutes(value)}
      </Text>
    ) : (
      <Text size="sm" c="dimmed">
        0
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Timesheets"
        description="Monthly work days, leave, lateness and overtime computed from recorded check-in times."
      />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <Group align="flex-end" wrap="wrap">
          <Select
            label={tx("Month")}
            data={monthOptions(tx("Month"))}
            value={String(month)}
            allowDeselect={false}
            onChange={(value) => {
              setMonth(Number(value));
              setPage(1);
            }}
            w={140}
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
          <TextInput
            label={tx("Search employee")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            w={240}
          />
        </Group>
      </Paper>
      <DataTable<TimesheetRow>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        rowKey={(item) => item.employee.id}
        tableMinWidth={1100}
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
          {
            key: "department",
            label: "Department",
            render: (item) => item.employee.department?.name ?? "-"
          },
          {
            key: "workDays",
            label: "Work days",
            render: (item) =>
              `${formatDays(item.timesheet.attendanceDays)} / ${item.timesheet.standardWorkDays}`
          },
          {
            key: "paidLeave",
            label: "Paid leave",
            render: (item) => formatDays(item.timesheet.paidLeaveDays)
          },
          {
            key: "unpaidLeave",
            label: "Unpaid leave",
            render: (item) => formatDays(item.timesheet.unpaidLeaveDays)
          },
          {
            key: "late",
            label: "Late",
            render: (item) => minutesCell(item.timesheet.lateMinutes, "yellow.8")
          },
          {
            key: "early",
            label: "Early leave",
            render: (item) => minutesCell(item.timesheet.earlyLeaveMinutes, "orange.7")
          },
          {
            key: "overtime",
            label: "Overtime",
            render: (item) => minutesCell(item.timesheet.overtimeMinutes, "teal.7")
          },
          {
            key: "missing",
            label: "Missing check-outs",
            render: (item) =>
              item.timesheet.missingCheckOuts ? (
                <Badge color="red" variant="light">
                  {item.timesheet.missingCheckOuts}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  0
                </Text>
              )
          },
          {
            key: "actions",
            label: "",
            render: (item) => (
              <Group justify="flex-end">
                <Tooltip label={tx("View attendance records")}>
                  <ActionIcon variant="subtle" onClick={() => openRecords(item)}>
                    <Eye size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
    </Stack>
  );
}
