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
import { Clock, LogIn, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { attendanceApi } from "../../api/endpoints";
import { formatDate, formatDateTime } from "../../api/format";
import type { AttendanceRecord } from "../../api/types";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { PermissionGate } from "../../components/PermissionGate";
import { useTranslation } from "../../i18n";
import { useAuthStore } from "../../store/auth";
import { EmployeeSelect } from "./EmployeeSelect";

type AttendancePageProps = {
  scope: "all" | "team";
};

function getBrowserAttendanceLocation() {
  if (!navigator.geolocation) {
    return Promise.resolve({});
  }

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
      () => reject(new Error("Cannot read your location")),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  });
}

function attendanceStatusColor(status?: string | null) {
  switch (status) {
    case "ON_TIME":
      return "green";
    case "LATE":
    case "EARLY_OUT":
      return "yellow";
    case "MANUAL_ADJUSTMENT":
      return "blue";
    default:
      return "gray";
  }
}

function formatDistance(value?: number | null) {
  return typeof value === "number" ? `${value} m` : "-";
}

export function AttendancePage({ scope }: AttendancePageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  // Links can preselect an employee and date range through the query string.
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState<string | null>(searchParams.get("employeeId"));
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") ?? "");
  const [page, setPage] = useState(1);
  const hasEmployeeProfile = useAuthStore((state) => Boolean(state.user?.employeeId));
  const listQuery = useQuery({
    queryKey: ["attendance", scope, employeeId, fromDate, toDate, page],
    queryFn: () =>
      scope === "team"
        ? attendanceApi.team({ employeeId: employeeId ? Number(employeeId) : undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, page, limit: 20 })
        : attendanceApi.list({ employeeId: employeeId ? Number(employeeId) : undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, page, limit: 20 })
  });

  const form = useForm({
    initialValues: {
      employeeId: "",
      workDate: "",
      recordedAt: "",
      recordType: "CHECK_IN",
      note: ""
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async () => attendanceApi.checkIn(await getBrowserAttendanceLocation()),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Checked in") });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const checkOutMutation = useMutation({
    mutationFn: async () => attendanceApi.checkOut(await getBrowserAttendanceLocation()),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Checked out") });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const adminCreateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      attendanceApi.adminCreate({
        ...values,
        employeeId: Number(values.employeeId),
        recordedAt: new Date(values.recordedAt).toISOString()
    }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Attendance adjustment created") });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "Team Attendance" : "Attendance"}
        description={scope === "team" ? "Review attendance records for your team." : "Review and adjust attendance records."}
        actions={
          <Group>
            {hasEmployeeProfile ? (
              <>
                <PermissionGate permissions={["ATTENDANCE_CHECK_IN"]}>
                  <Button leftSection={<LogIn size={16} />} variant="light" onClick={() => checkInMutation.mutate()} loading={checkInMutation.isPending}>{tx("Check-in")}</Button>
                </PermissionGate>
                <PermissionGate permissions={["ATTENDANCE_CHECK_OUT"]}>
                  <Button leftSection={<LogOut size={16} />} variant="light" onClick={() => checkOutMutation.mutate()} loading={checkOutMutation.isPending}>{tx("Check-out")}</Button>
                </PermissionGate>
              </>
            ) : null}
            {scope === "all" ? <PermissionGate permissions={["ATTENDANCE_ADJUST"]}><Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>{tx("Adjustment")}</Button></PermissionGate> : null}
          </Group>
        }
      />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <EmployeeSelect
          scope={scope}
          label={tx("Employee")}
          placeholder={tx("All employees")}
          clearable
          value={employeeId}
          onChange={(value) => {
            setEmployeeId(value);
            setPage(1);
          }}
        />
        <TextInput
          label={tx("From date")}
          type="date"
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.currentTarget.value);
            setPage(1);
          }}
        />
        <TextInput
          label={tx("To date")}
          type="date"
          value={toDate}
          onChange={(event) => {
            setToDate(event.currentTarget.value);
            setPage(1);
          }}
        />
        </SimpleGrid>
      </Paper>
      <DataTable<AttendanceRecord>
        data={listQuery.data?.items ?? []}
        loading={listQuery.isLoading}
        error={listQuery.error ? getApiErrorMessage(listQuery.error) : null}
        total={listQuery.data?.meta.total}
        limit={listQuery.data?.meta.limit}
        page={listQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          { key: "employee", label: "Employee", render: (item) => <Stack gap={0}><Text fw={700}>{item.employee.fullName}</Text><Text size="xs" c="dimmed">{item.employee.employeeCode}</Text></Stack> },
          { key: "date", label: "Work date", render: (item) => formatDate(item.workDate) },
          { key: "type", label: "Type", render: (item) => <Badge color={item.recordType === "CHECK_IN" ? "green" : item.recordType === "CHECK_OUT" ? "blue" : "yellow"}>{te(item.recordType)}</Badge> },
          { key: "shift", label: "Shift", render: (item) => item.shift ? <Badge variant="light">{te(item.shift)}</Badge> : "-" },
          { key: "status", label: "Attendance status", render: (item) => item.attendanceStatus ? <Badge color={attendanceStatusColor(item.attendanceStatus)}>{te(item.attendanceStatus)}</Badge> : "-" },
          { key: "time", label: "Recorded at", render: (item) => formatDateTime(item.recordedAt) },
          { key: "location", label: "Location", render: (item) => typeof item.latitude === "number" && typeof item.longitude === "number" ? <Stack gap={0}><Text size="sm">{formatDistance(item.distanceMeters)}</Text><Text size="xs" c="dimmed">{item.address ?? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}</Text></Stack> : "-" },
          { key: "source", label: "Source", render: (item) => item.source },
          { key: "note", label: "Note", render: (item) => item.note ?? "-" },
          { key: "icon", label: "", render: () => <Tooltip label={tx("Attendance record")}><ActionIcon variant="subtle"><Clock size={16} /></ActionIcon></Tooltip> }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={tx("Attendance adjustment")}>
        <form onSubmit={form.onSubmit((values) => adminCreateMutation.mutate(values))}>
          <Stack>
            <EmployeeSelect
              scope="all"
              label={tx("Employee")}
              placeholder={tx("Search employee")}
              required
              value={form.values.employeeId || null}
              onChange={(value) => form.setFieldValue("employeeId", value ?? "")}
              error={form.errors.employeeId}
            />
            <TextInput label={tx("Work date")} type="date" required {...form.getInputProps("workDate")} />
            <TextInput label={tx("Recorded at")} type="datetime-local" required {...form.getInputProps("recordedAt")} />
            <Select label={tx("Record type")} data={["CHECK_IN", "CHECK_OUT", "ADJUSTMENT"].map((value) => ({ value, label: te(value) }))} required {...form.getInputProps("recordType")} />
            <TextInput label={tx("Reason")} required {...form.getInputProps("note")} />
            <Button type="submit" loading={adminCreateMutation.isPending}>{tx("Save adjustment")}</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
