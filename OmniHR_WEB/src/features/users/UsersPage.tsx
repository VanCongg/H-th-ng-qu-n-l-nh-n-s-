import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Paper,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import {
  departmentsApi,
  employeeSkillsApi,
  positionsApi,
  rolesApi,
  skillsApi,
  usersApi
} from "../../api/endpoints";
import {
  careerLevelOptions,
  formatDepartmentName,
  formatEmployeeJobTitle
} from "../../api/format";
import type { Department, Position, Role, Skill, UserSummary } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { EmployeeAvatar } from "../../components/EmployeeAvatar";
import { EmployeeAvatarUpload } from "../../components/EmployeeAvatarUpload";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function UsersPage() {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["users", search, page],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        page,
        limit: 20
      })
  });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsApi.list()
  });
  const positionsQuery = useQuery({
    queryKey: ["positions"],
    queryFn: () => positionsApi.list()
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "user-form"],
    queryFn: () => skillsApi.list({ limit: 100 })
  });
  const employeeRoleId = rolesQuery.data
    ?.find((role) => role.name === "EMPLOYEE")
    ?.id.toString();
  const managerRoleId = rolesQuery.data
    ?.find((role) => role.name === "MANAGER")
    ?.id.toString();

  const form = useForm({
    initialValues: {
      username: "",
      email: "",
      password: "",
      isActive: true,
      mustChangePassword: true,
      roleIds: [] as string[],
      employeeCode: "",
      fullName: "",
      avatarUrl: "",
      birthDate: "",
      hireDate: "",
      employeeStatus: "ACTIVE",
      departmentId: "",
      positionId: "",
      careerLevel: "FRESHER",
      skillIds: [] as string[],
      isDepartmentManager: false
    },
    validate: {
      employeeCode: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value.trim()
          ? tx("Required")
          : null,
      fullName: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value.trim()
          ? tx("Required")
          : null,
      birthDate: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value
          ? tx("Required")
          : null,
      departmentId: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value
          ? tx("Required")
          : null,
      positionId: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value
          ? tx("Required")
          : null,
      careerLevel: (value, values) =>
        shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
        !value
          ? tx("Required")
          : null
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const payload: Record<string, unknown> = {
        username: values.username,
        email: values.email,
        isActive: values.isActive,
        mustChangePassword: values.mustChangePassword,
        roleIds: values.roleIds.map(Number)
      };

      if (values.password) {
        payload.password = values.password;
      }

      const shouldSaveEmployeeProfile = shouldUseEmployeeProfile(
        values.roleIds,
        rolesQuery.data ?? [],
        editing
      );

      if (shouldSaveEmployeeProfile) {
        payload.employeeProfile = {
          employeeCode: values.employeeCode,
          fullName: values.fullName,
          avatarUrl: values.avatarUrl.trim() || null,
          birthDate: values.birthDate,
          hireDate: values.hireDate || undefined,
          status: values.employeeStatus,
          departmentId: Number(values.departmentId),
          positionId: Number(values.positionId),
          careerLevel: values.careerLevel
        };
      }

      const savedUser = editing
        ? await usersApi.update(editing.id, payload)
        : await usersApi.create(payload);
      if (shouldSaveEmployeeProfile && savedUser.employee?.id) {
        await syncEmployeeSkills(
          savedUser.employee.id,
          values.skillIds.map(Number)
        );
        await syncDepartmentManager({
          employeeId: savedUser.employee.id,
          departmentId: values.departmentId ? Number(values.departmentId) : null,
          shouldSet: values.isDepartmentManager && canUseDepartmentManagerFlag({
            departmentId: values.departmentId,
            positionId: values.positionId,
            editingUser: editing,
            positions: positionsQuery.data ?? [],
            departments: departmentsQuery.data ?? []
          }),
          editingUser: editing,
          departments: departmentsQuery.data ?? []
        });
      }
      return savedUser;
    },
    onSuccess: (savedUser) => {
      notifications.show({
        color: "green",
        message: tx(savedUser.employee ? "Employee saved" : "User saved")
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-skills"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    }
  });
  const resetMutation = useMutation({
    mutationFn: (id: number) =>
      usersApi.resetPassword(id, {
        password: "Admin@123456",
        mustChangePassword: true
      }),
    onSuccess: () =>
      notifications.show({
        color: "green",
        message: tx("Password reset to Admin@123456")
      })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({
      username: "",
      email: "",
      password: "",
      isActive: true,
      mustChangePassword: true,
      roleIds: employeeRoleId ? [employeeRoleId] : [],
      employeeCode: "",
      fullName: "",
      avatarUrl: "",
      birthDate: "",
      hireDate: "",
      employeeStatus: "ACTIVE",
      departmentId: "",
      positionId: "",
      careerLevel: "FRESHER",
      skillIds: [],
      isDepartmentManager: false
    });
    setOpened(true);
  }

  function openEdit(item: UserSummary) {
    setEditing(item);
    const departmentId = item.employee?.department?.id ?? item.employee?.departmentId;
    const currentDepartment = (departmentsQuery.data ?? []).find(
      (department) => department.id === departmentId
    );
    const roleIds = item.userRoles?.map((role) => String(role.role.id)) ?? [];
    if (
      managerRoleId &&
      isManagerPosition(item.employee?.position) &&
      !roleIds.includes(managerRoleId)
    ) {
      roleIds.push(managerRoleId);
    }
    form.setValues({
      username: item.username,
      email: item.email,
      password: "",
      isActive: item.isActive,
      mustChangePassword: item.mustChangePassword,
      roleIds,
      employeeCode: item.employee?.employeeCode ?? "",
      fullName: item.employee?.fullName ?? "",
      avatarUrl: item.employee?.avatarUrl ?? "",
      birthDate: item.employee?.birthDate?.slice(0, 10) ?? "",
      hireDate: item.employee?.hireDate?.slice(0, 10) ?? "",
      employeeStatus: item.employee?.status ?? "ACTIVE",
      departmentId: item.employee?.department?.id
        ? String(item.employee.department.id)
        : "",
      positionId: item.employee?.position?.id ? String(item.employee.position.id) : "",
      careerLevel: item.employee?.careerLevel ?? "FRESHER",
      skillIds:
        item.employee?.employeeSkills?.map((employeeSkill) =>
          String(employeeSkill.skillId)
        ) ?? [],
      isDepartmentManager: Boolean(
        item.employee &&
          (item.employee.department?.managerId === item.employee.id ||
            currentDepartment?.managerId === item.employee.id)
      )
    });
    setOpened(true);
  }

  function applySearch() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: String(role.id),
    label: role.name
  }));
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
  const careerOptions = careerLevelOptions(te);
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
  const selectedPosition = positionsQuery.data?.find(
    (item) => String(item.id) === form.values.positionId
  );
  const usesEmployeeProfile = shouldUseEmployeeProfile(
    form.values.roleIds,
    rolesQuery.data ?? [],
    editing
  );
  const canSetDepartmentManager = canUseDepartmentManagerFlag({
    departmentId: form.values.departmentId,
    positionId: form.values.positionId,
    editingUser: editing,
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

  function handleRoleChange(values: string[]) {
    if (
      shouldUseEmployeeProfile(values, rolesQuery.data ?? [], editing) &&
      managerRoleId &&
      isManagerPosition(selectedPosition) &&
      !values.includes(managerRoleId)
    ) {
      notifications.show({
        color: "yellow",
        message: tx("Manager position requires MANAGER role")
      });
      form.setFieldValue("roleIds", [...values, managerRoleId]);
      return;
    }

    form.setFieldValue("roleIds", values);
    if (!shouldUseEmployeeProfile(values, rolesQuery.data ?? [], editing)) {
      form.setFieldValue("isDepartmentManager", false);
    }
  }

  function handlePositionChange(value: string | null) {
    const nextValue = value ?? "";
    const position = positionsQuery.data?.find(
      (item) => String(item.id) === nextValue
    );
    form.setFieldValue("positionId", nextValue);
    if (
      !canUseDepartmentManagerFlag({
        departmentId: form.values.departmentId,
        positionId: nextValue,
        editingUser: editing,
        positions: positionsQuery.data ?? [],
        departments: departmentsQuery.data ?? []
      })
    ) {
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

    if (
      managerRoleId &&
      isManagerPosition(position) &&
      !form.values.roleIds.includes(managerRoleId)
    ) {
      form.setFieldValue("roleIds", [...form.values.roleIds, managerRoleId]);
    }
  }

  function save(values: typeof form.values) {
    const position = positionsQuery.data?.find(
      (item) => String(item.id) === values.positionId
    );
    if (
      shouldUseEmployeeProfile(values.roleIds, rolesQuery.data ?? [], editing) &&
      isManagerPosition(position) &&
      (!managerRoleId || !values.roleIds.includes(managerRoleId))
    ) {
      form.setFieldError("roleIds", tx("Manager position requires MANAGER role"));
      return;
    }

    saveMutation.mutate(values);
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Employees"
        description="Manage employee profiles, login access, and role assignment."
        actions={
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            {tx("New employee")}
          </Button>
        }
      />
      <Paper withBorder radius="md" p="md" className="filter-bar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              placeholder={tx("Search by name, code, or email")}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
              style={{ flex: "1 1 260px" }}
            />
            <Button
              type="submit"
              leftSection={<Search size={16} />}
              style={{ flex: "0 0 auto" }}
            >
              {tx("Search")}
            </Button>
          </Group>
        </form>
      </Paper>
      <DataTable<UserSummary>
        data={query.data?.items ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        total={query.data?.meta.total}
        limit={query.data?.meta.limit}
        page={query.data?.meta.page}
        onPageChange={setPage}
        columns={[
          {
            key: "username",
            label: "Username",
            render: (item) => <Text fw={700}>{item.username}</Text>
          },
          { key: "email", label: "Email", render: (item) => item.email },
          {
            key: "employee",
            label: "Employee",
            render: (item) =>
              item.employee ? (
                <Group gap="sm" wrap="nowrap">
                  <EmployeeAvatar employee={item.employee} />
                  <Stack gap={0}>
                    <Text fw={700} size="sm">
                      {item.employee.fullName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.employee.employeeCode}
                    </Text>
                  </Stack>
                </Group>
              ) : (
                "-"
              )
          },
          {
            key: "department",
            label: "Department",
            render: (item) => formatDepartmentName(item.employee?.department, tx)
          },
          {
            key: "position",
            label: "Position",
            render: (item) => formatEmployeeJobTitle(item.employee, te)
          },
          {
            key: "roles",
            label: "Roles",
            render: (item) => (
              <Group gap={4}>
                {item.userRoles?.map((role) => (
                  <Badge key={role.role.id}>{role.role.name}</Badge>
                ))}
              </Group>
            )
          },
          {
            key: "active",
            label: "Active",
            render: (item) => (item.isActive ? tx("Yes") : tx("No"))
          },
          {
            key: "actions",
            label: "",
            render: (item) => (
              <Group justify="flex-end" gap={4}>
                <Tooltip label={tx("Edit")}>
                  <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                    <Edit size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tx("Reset password")}>
                  <ActionIcon
                    color="yellow"
                    variant="subtle"
                    onClick={() => resetMutation.mutate(item.id)}
                  >
                    <KeyRound size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tx("Disable")}>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Disable employee"),
                        message: `${tx("Disable")} ${item.username}?`,
                        confirmLabel: tx("Disable"),
                        onConfirm: () => deleteMutation.mutate(item.id)
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )
          }
        ]}
      />
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? tx("Edit employee") : tx("New employee")}
        size="min(1120px, 96vw)"
      >
        <form onSubmit={form.onSubmit(save)}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label={tx("Username")}
                required
                {...form.getInputProps("username")}
              />
              <TextInput
                label={tx("Email")}
                required
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label={editing ? tx("New password") : tx("Password")}
                required={!editing}
                {...form.getInputProps("password")}
              />
              <MultiSelect
                label={tx("Roles")}
                data={roleOptions}
                value={form.values.roleIds}
                onChange={handleRoleChange}
                error={form.errors.roleIds}
              />
              <Switch
                label={tx("Active")}
                {...form.getInputProps("isActive", { type: "checkbox" })}
              />
              <Switch
                label={tx("Must change password")}
                {...form.getInputProps("mustChangePassword", { type: "checkbox" })}
              />
            </SimpleGrid>

            {usesEmployeeProfile ? (
              <>
                <Text fw={700}>{tx("Employee profile")}</Text>
                <div className="employee-form-layout">
                  <EmployeeAvatarUpload
                    value={form.values.avatarUrl}
                    fullName={form.values.fullName}
                    onChange={(value) =>
                      form.setFieldValue("avatarUrl", value ?? "")
                    }
                  />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label={tx("Employee code")}
                      required
                      {...form.getInputProps("employeeCode")}
                    />
                    <TextInput
                      label={tx("Full name")}
                      required
                      {...form.getInputProps("fullName")}
                    />
                    <TextInput
                      label={tx("Birth date")}
                      type="date"
                      required
                      {...form.getInputProps("birthDate")}
                    />
                    <TextInput
                      label={tx("Hire date")}
                      type="date"
                      {...form.getInputProps("hireDate")}
                    />
                    <Select
                      label={tx("Status")}
                      data={["ACTIVE", "INACTIVE", "TERMINATED"].map((value) => ({
                        value,
                        label: te(value)
                      }))}
                      {...form.getInputProps("employeeStatus")}
                    />
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
                  {...form.getInputProps("isDepartmentManager", {
                    type: "checkbox"
                  })}
                />
              </>
            ) : null}

            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function isManagerPosition(position?: Pick<Position, "code" | "name"> | null) {
  if (!position) {
    return false;
  }

  const value = `${position.code} ${position.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(manager|lead|leader|head|director|supervisor|truong|quan ly)\b/.test(
    value
  );
}

function canUseDepartmentManagerFlag({
  departmentId,
  positionId,
  editingUser,
  positions,
  departments
}: {
  departmentId: string;
  positionId: string;
  editingUser: UserSummary | null;
  positions: Position[];
  departments: Department[];
}) {
  if (!departmentId || !positionId) {
    return false;
  }

  const selectedPosition = positions.find((item) => String(item.id) === positionId);
  if (isManagerPosition(selectedPosition)) {
    return true;
  }

  const employee = editingUser?.employee;
  const selectedDepartmentId = Number(departmentId);
  const selectedDepartment = departments.find((item) => item.id === selectedDepartmentId);
  const editingDepartmentId = employee?.department?.id ?? employee?.departmentId;
  return Boolean(
    employee &&
      selectedDepartmentId === editingDepartmentId &&
      (employee.department?.managerId === employee.id ||
        selectedDepartment?.managerId === employee.id)
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

function shouldUseEmployeeProfile(
  roleIds: string[],
  roles: Array<Pick<Role, "id" | "name">>,
  editingUser: UserSummary | null
) {
  if (editingUser?.employee) {
    return true;
  }

  if (!roleIds.length) {
    return true;
  }

  const selectedRoleNames = roleIds.map((roleId) => {
    const role = roles.find((item) => String(item.id) === roleId);
    if (role) {
      return role.name;
    }

    return editingUser?.userRoles?.find(
      (item) => String(item.role.id) === roleId
    )?.role.name;
  });

  if (selectedRoleNames.some((roleName) => !roleName)) {
    return true;
  }

  return selectedRoleNames.some((roleName) => roleName !== "ADMIN");
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
  editingUser,
  departments
}: {
  employeeId: number;
  departmentId: number | null;
  shouldSet: boolean;
  editingUser: UserSummary | null;
  departments: Department[];
}) {
  const employee = editingUser?.employee;
  const oldDepartmentId = employee?.department?.id ?? employee?.departmentId;
  const oldDepartment = departments.find((item) => item.id === oldDepartmentId);
  const hasOldDepartment = typeof oldDepartmentId === "number";
  const wasDepartmentManager = Boolean(
    employee &&
      hasOldDepartment &&
      (employee.department?.managerId === employee.id ||
        oldDepartment?.managerId === employee.id)
  );

  if (hasOldDepartment && wasDepartmentManager && (!shouldSet || oldDepartmentId !== departmentId)) {
    await departmentsApi.update(oldDepartmentId, { managerId: null });
  }

  if (shouldSet && departmentId) {
    await departmentsApi.update(departmentId, { managerId: employeeId });
  }
}
