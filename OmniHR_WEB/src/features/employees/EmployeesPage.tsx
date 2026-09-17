import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
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
import { Edit, KeyRound, Lock, Plus, Search, Trash2, Unlock, X } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import {
  departmentsApi,
  employeeSkillsApi,
  employeesApi,
  positionsApi,
  skillsApi
} from "../../api/endpoints";
import {
  careerLevelOptions,
  formatDate,
  formatDepartmentName,
  statusColor
} from "../../api/format";
import type { Department, Employee, EmployeeCreateResult, Position, Skill } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { EmployeeAvatar } from "../../components/EmployeeAvatar";
import { EmployeeAvatarUpload } from "../../components/EmployeeAvatarUpload";
import { PageHeader } from "../../components/PageHeader";
import { PositionLabel } from "../../components/PositionLabel";
import { useAuthStore } from "../../store/auth";
import { useTranslation } from "../../i18n";

type EmployeesPageProps = {
  scope: "all" | "team";
};

export function EmployeesPage({ scope }: EmployeesPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [careerLevelFilter, setCareerLevelFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [defaultPassword, setDefaultPassword] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: [
      "employees",
      scope,
      search,
      departmentFilter,
      positionFilter,
      statusFilter,
      careerLevelFilter,
      page
    ],
    queryFn: () =>
      scope === "team"
        ? employeesApi.team({
            search: search || undefined,
            departmentId: departmentFilter ? Number(departmentFilter) : undefined,
            positionId: positionFilter ? Number(positionFilter) : undefined,
            status: statusFilter || undefined,
            careerLevel: careerLevelFilter,
            page,
            limit: 20
          })
        : employeesApi.list({
            search: search || undefined,
            departmentId: departmentFilter ? Number(departmentFilter) : undefined,
            positionId: positionFilter ? Number(positionFilter) : undefined,
            status: statusFilter || undefined,
            careerLevel: careerLevelFilter,
            page,
            limit: 20
          })
  });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: () => departmentsApi.list() });
  // Managers do not hold POSITION_READ; asking anyway only produced 403s.
  const canReadPositions = useAuthStore((state) => state.hasPermission("POSITION_READ"));
  const positionsQuery = useQuery({
    queryKey: ["positions"],
    queryFn: () => positionsApi.list(),
    enabled: canReadPositions
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "employee-form"],
    queryFn: () => skillsApi.list({ limit: 100 })
  });

  const form = useForm({
    initialValues: {
      employeeCode: "",
      fullName: "",
      companyEmail: "",
      avatarUrl: "",
      personalEmail: "",
      phone: "",
      birthDate: "",
      hireDate: "",
      status: "ACTIVE",
      departmentId: "",
      positionId: "",
      careerLevel: "FRESHER",
      skillIds: [] as string[],
      isDepartmentManager: false
    },
    validate: {
      departmentId: (value) => (!value ? tx("Required") : null),
      positionId: (value) => (!value ? tx("Required") : null)
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const payload = normalizeEmployeePayload(values);
      const result = editing
        ? await employeesApi.update(editing.id, payload)
        : await employeesApi.create(payload);
      const employeeId = "employeeId" in result ? result.employeeId : result.id;
      await syncEmployeeSkills(employeeId, values.skillIds.map(Number));
      await syncDepartmentManager({
        employeeId,
        departmentId: payload.departmentId ?? null,
        shouldSet: values.isDepartmentManager && canUseDepartmentManagerFlag({
          departmentId: values.departmentId,
          positionId: values.positionId,
          editingEmployee: editing,
          positions: positionsQuery.data ?? [],
          departments: departmentsQuery.data ?? []
        }),
        editingEmployee: editing,
        departments: departmentsQuery.data ?? []
      });
      return result;
    },
    onSuccess: (result: Employee | EmployeeCreateResult) => {
      notifications.show({ color: "green", message: tx("Employee saved") });
      if ("defaultPassword" in result) {
        setDefaultPassword(result.defaultPassword);
      }
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-skills"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
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
    form.setFieldValue("careerLevel", "FRESHER");
    form.setFieldValue("skillIds", []);
    form.setFieldValue("isDepartmentManager", false);
    form.setFieldValue("avatarUrl", "");
    setOpened(true);
  }

  function openEdit(item: Employee) {
    setEditing(item);
    const departmentId = item.department?.id ?? item.departmentId;
    const currentDepartment = (departmentsQuery.data ?? []).find(
      (department) => department.id === departmentId
    );
    form.setValues({
      employeeCode: item.employeeCode,
      fullName: item.fullName,
      companyEmail: item.companyEmail,
      avatarUrl: item.avatarUrl ?? "",
      personalEmail: item.personalEmail ?? "",
      phone: item.phone ?? "",
      birthDate: item.birthDate?.slice(0, 10) ?? "",
      hireDate: item.hireDate?.slice(0, 10) ?? "",
      status: item.status,
      departmentId: item.department?.id ? String(item.department.id) : "",
      positionId: item.position?.id ? String(item.position.id) : "",
      careerLevel: item.careerLevel ?? "FRESHER",
      skillIds:
        item.employeeSkills?.map((employeeSkill) =>
          String(employeeSkill.skillId)
        ) ?? [],
      isDepartmentManager: Boolean(
        item.department?.managerId === item.id ||
          currentDepartment?.managerId === item.id
      )
    });
    setOpened(true);
  }

  function applySearch() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setDepartmentFilter(null);
    setPositionFilter(null);
    setStatusFilter(null);
    setCareerLevelFilter(null);
    setPage(1);
  }

  const departmentIdsWithPositions = new Set(
    (positionsQuery.data ?? [])
      .filter((item) => item.isActive && item.departmentId)
      .map((item) => String(item.departmentId))
  );
  const departmentOptions = (departmentsQuery.data ?? [])
    .filter((item) => departmentIdsWithPositions.has(String(item.id)))
    .map((item) => ({
      value: String(item.id),
      label: formatDepartmentName(item, tx)
    }));
  const filterDepartmentOptions = (departmentsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: formatDepartmentName(item, tx)
  }));
  const positionOptions = (positionsQuery.data ?? [])
    .filter(
      (item) =>
        form.values.departmentId &&
        item.departmentId &&
        String(item.departmentId) === form.values.departmentId
    )
    .map((item) => ({
      value: String(item.id),
      label: item.name
    }));
  const filterPositionOptions = (positionsQuery.data ?? [])
    .filter(
      (item) =>
        item.isActive &&
        (!departmentFilter ||
          (item.departmentId && String(item.departmentId) === departmentFilter))
    )
    .map((item) => ({
      value: String(item.id),
      label: item.department
        ? `${item.name} - ${formatDepartmentName(item.department, tx)}`
        : item.name
    }));
  const careerOptions = careerLevelOptions(te);
  const statusOptions = ["ACTIVE", "INACTIVE", "TERMINATED"].map((value) => ({
    value,
    label: te(value)
  }));
  const hasActiveFilters = Boolean(
    search || departmentFilter || positionFilter || statusFilter || careerLevelFilter
  );
  const skillOptions = (skillsQuery.data?.items ?? [])
    .filter(
      (item) =>
        item.isActive &&
        skillAppliesToPosition(item, form.values.positionId)
    )
    .map((item) => ({
      value: String(item.id),
      label: `${item.code} - ${item.name}`
    }));
  const canSetDepartmentManager = canUseDepartmentManagerFlag({
    departmentId: form.values.departmentId,
    positionId: form.values.positionId,
    editingEmployee: editing,
    positions: positionsQuery.data ?? [],
    departments: departmentsQuery.data ?? []
  });

  function handleDepartmentChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("departmentId", nextValue);

    const currentPosition = positionsQuery.data?.find(
      (item) => String(item.id) === form.values.positionId
    );
    if (!currentPosition || String(currentPosition.departmentId) !== nextValue) {
      form.setFieldValue("positionId", "");
      form.setFieldValue("skillIds", []);
      form.setFieldValue("isDepartmentManager", false);
    }
    if (!nextValue) {
      form.setFieldValue("isDepartmentManager", false);
    }
  }

  function handlePositionChange(value: string | null) {
    const nextValue = value ?? "";
    form.setFieldValue("positionId", nextValue);
    const nextPosition = positionsQuery.data?.find(
      (item) => String(item.id) === nextValue
    );
    if (!isDepartmentManagerPosition(nextPosition)) {
      form.setFieldValue("isDepartmentManager", false);
    }
    form.setFieldValue(
      "skillIds",
      filterSkillIdsForPosition(
        form.values.skillIds,
        nextValue,
        skillsQuery.data?.items ?? []
      )
    );
  }

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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <TextInput
              label={tx("Search")}
              placeholder={tx("Search by name, code, or email")}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
            />
            <Select
              label={tx("Department")}
              placeholder={tx("All departments")}
              data={filterDepartmentOptions}
              value={departmentFilter}
              searchable
              clearable
              onChange={(value) => {
                setDepartmentFilter(value);
                setPositionFilter(null);
                setPage(1);
              }}
            />
            {canReadPositions ? (
              <Select
                label={tx("Position")}
                placeholder={tx("All positions")}
                data={filterPositionOptions}
                value={positionFilter}
                searchable
                clearable
                disabled={!filterPositionOptions.length}
                onChange={(value) => {
                  setPositionFilter(value);
                  setPage(1);
                }}
              />
            ) : null}
            <Select
              label={tx("Status")}
              placeholder={tx("All statuses")}
              data={statusOptions}
              value={statusFilter}
              clearable
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
            <Select
              label={tx("Career level")}
              placeholder={tx("All levels")}
              data={careerOptions}
              value={careerLevelFilter}
              onChange={(value) => {
                setCareerLevelFilter(value);
                setPage(1);
              }}
              clearable
            />
          </SimpleGrid>
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button
              variant="subtle"
              leftSection={<X size={16} />}
              disabled={!hasActiveFilters && !searchDraft}
              onClick={clearFilters}
            >
              {tx("Clear filters")}
            </Button>
            <Button type="submit" leftSection={<Search size={16} />}>
              {tx("Search")}
            </Button>
          </Group>
        </form>
      </Paper>

      <DataTable<Employee>
        tableMinWidth={980}
        rowKey={(item) => item.id}
        data={employeesQuery.data?.items ?? []}
        loading={employeesQuery.isLoading}
        error={employeesQuery.error ? getApiErrorMessage(employeesQuery.error) : null}
        total={employeesQuery.data?.meta.total}
        limit={employeesQuery.data?.meta.limit}
        page={employeesQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.employeeCode}</Text> },
          { key: "name", label: "Name", render: (item) => <Group gap="sm" wrap="nowrap"><EmployeeAvatar employee={item} /><Stack gap={0}><Text fw={700}>{item.fullName}</Text><Text size="xs" c="dimmed">{item.companyEmail}</Text></Stack></Group> },
          { key: "department", label: "Department", render: (item) => formatDepartmentName(item.department, tx) },
          { key: "position", label: "Position", render: (item) => <PositionLabel employee={item} /> },
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
                    <ActionIcon variant="subtle" color="red" onClick={() => openConfirmModal({ title: tx("Disable employee"), message: `${tx("Disable")} ${item.fullName}?`, description: tx("This locks the account, signs them out on every device, and removes them from employee lists and reporting lines."), confirmLabel: tx("Disable"), onConfirm: () => removeMutation.mutate(item.id) })}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ) : null
          }
        ]}
      />

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit employee") : tx("New employee")} size="min(1120px, 96vw)">
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <div className="employee-form-layout">
              <EmployeeAvatarUpload
                value={form.values.avatarUrl}
                fullName={form.values.fullName}
                onChange={(value) => form.setFieldValue("avatarUrl", value ?? "")}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label={tx("Employee code")} required {...form.getInputProps("employeeCode")} />
                <TextInput label={tx("Full name")} required {...form.getInputProps("fullName")} />
                <TextInput label={tx("Company email")} required {...form.getInputProps("companyEmail")} />
                <TextInput label={tx("Personal email")} {...form.getInputProps("personalEmail")} />
                <TextInput label={tx("Phone")} {...form.getInputProps("phone")} />
                <TextInput label={tx("Birth date")} type="date" required {...form.getInputProps("birthDate")} />
                <TextInput label={tx("Hire date")} type="date" {...form.getInputProps("hireDate")} />
                <Select label={tx("Status")} data={["ACTIVE", "INACTIVE", "TERMINATED"].map((value) => ({ value, label: te(value) }))} {...form.getInputProps("status")} />
                <Select
                  label={tx("Department")}
                  data={departmentOptions}
                  required
                  searchable
                  value={form.values.departmentId || null}
                  onChange={handleDepartmentChange}
                  error={form.errors.departmentId}
                />
                <Select
                  label={tx("Position")}
                  data={positionOptions}
                  required
                  searchable
                  disabled={!form.values.departmentId}
                  placeholder={
                    form.values.departmentId
                      ? tx("Select position")
                      : tx("Select department first")
                  }
                  value={form.values.positionId || null}
                  onChange={handlePositionChange}
                  error={form.errors.positionId}
                />
                <Select
                  label={tx("Career level")}
                  data={careerOptions}
                  required
                  {...form.getInputProps("careerLevel")}
                />
                <MultiSelect
                  label={tx("Skills")}
                  data={skillOptions}
                  searchable
                  clearable
                  disabled={!form.values.positionId || skillsQuery.isLoading}
                  placeholder={
                    form.values.positionId
                      ? tx("Select skills")
                      : tx("Select position first")
                  }
                  {...form.getInputProps("skillIds")}
                />
              </SimpleGrid>
            </div>
            <Checkbox
              label={tx("Set as department manager")}
              disabled={!canSetDepartmentManager}
              {...form.getInputProps("isDepartmentManager", { type: "checkbox" })}
            />
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

function normalizeEmployeePayload(values: {
  employeeCode: string;
  fullName: string;
  companyEmail: string;
  avatarUrl: string;
  personalEmail: string;
  phone: string;
  birthDate: string;
  hireDate: string;
  status: string;
  departmentId: string;
  positionId: string;
  careerLevel: string;
  skillIds: string[];
  isDepartmentManager: boolean;
}) {
  return {
    employeeCode: values.employeeCode,
    fullName: values.fullName,
    companyEmail: values.companyEmail,
    avatarUrl: values.avatarUrl.trim() || null,
    personalEmail: values.personalEmail || undefined,
    phone: values.phone || undefined,
    birthDate: values.birthDate,
    hireDate: values.hireDate || undefined,
    status: values.status,
    departmentId: values.departmentId ? Number(values.departmentId) : undefined,
    positionId: values.positionId ? Number(values.positionId) : undefined,
    careerLevel: values.careerLevel
  };
}

function isDepartmentManagerPosition(position?: Pick<Position, "code" | "name"> | null) {
  if (!position) {
    return false;
  }
  const text = `${position.code} ${position.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return ["manager", "lead", "head", "director", "truong", "quan ly"].some(
    (keyword) => text.includes(keyword)
  );
}

function canUseDepartmentManagerFlag({
  departmentId,
  positionId,
  editingEmployee,
  positions,
  departments
}: {
  departmentId: string;
  positionId: string;
  editingEmployee: Employee | null;
  positions: Position[];
  departments: Department[];
}) {
  if (!departmentId || !positionId) {
    return false;
  }
  const selectedPosition = positions.find((item) => String(item.id) === positionId);
  if (isDepartmentManagerPosition(selectedPosition)) {
    return true;
  }
  const selectedDepartmentId = Number(departmentId);
  const selectedDepartment = departments.find((item) => item.id === selectedDepartmentId);
  const editingDepartmentId = editingEmployee?.department?.id ?? editingEmployee?.departmentId;
  return Boolean(
    editingEmployee &&
      selectedDepartmentId === editingDepartmentId &&
      (editingEmployee.department?.managerId === editingEmployee.id ||
        selectedDepartment?.managerId === editingEmployee.id)
  );
}

function skillAppliesToPosition(skill: Skill, positionId: string) {
  return Boolean(
    positionId &&
      skill.positionSkills?.some(
        (positionSkill) => String(positionSkill.positionId) === positionId
      )
  );
}

function filterSkillIdsForPosition(
  skillIds: string[],
  positionId: string,
  skills: Skill[]
) {
  return skillIds.filter((skillId) => {
    const skill = skills.find((item) => String(item.id) === skillId);
    return skill ? skillAppliesToPosition(skill, positionId) : false;
  });
}

async function syncEmployeeSkills(employeeId: number, desiredSkillIds: number[]) {
  const desiredIds = Array.from(new Set(desiredSkillIds));
  const existingSkills = await employeeSkillsApi.list(employeeId);
  const existingIds = new Set(existingSkills.map((item) => item.skillId));
  const desiredSet = new Set(desiredIds);

  await Promise.all([
    ...desiredIds
      .filter((skillId) => !existingIds.has(skillId))
      .map((skillId) => employeeSkillsApi.create(employeeId, { skillId })),
    ...existingSkills
      .filter((item) => !desiredSet.has(item.skillId))
      .map((item) => employeeSkillsApi.remove(item.id))
  ]);
}

async function syncDepartmentManager({
  employeeId,
  departmentId,
  shouldSet,
  editingEmployee,
  departments
}: {
  employeeId: number;
  departmentId: number | null;
  shouldSet: boolean;
  editingEmployee: Employee | null;
  departments: Department[];
}) {
  const oldDepartmentId = editingEmployee?.department?.id ?? editingEmployee?.departmentId;
  const oldDepartment = departments.find((item) => item.id === oldDepartmentId);
  const hasOldDepartment = typeof oldDepartmentId === "number";
  const wasDepartmentManager = Boolean(
    editingEmployee &&
      hasOldDepartment &&
      (editingEmployee.department?.managerId === editingEmployee.id ||
        oldDepartment?.managerId === editingEmployee.id)
  );

  if (hasOldDepartment && wasDepartmentManager && (!shouldSet || oldDepartmentId !== departmentId)) {
    await departmentsApi.update(oldDepartmentId, { managerId: null });
  }

  if (shouldSet && departmentId) {
    await departmentsApi.update(departmentId, { managerId: employeeId });
  }
}
