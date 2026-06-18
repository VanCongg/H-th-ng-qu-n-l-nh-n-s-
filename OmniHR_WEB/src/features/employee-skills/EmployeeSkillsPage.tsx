import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { employeeSkillsApi, employeesApi, skillsApi } from "../../api/endpoints";
import { formatDate } from "../../api/format";
import type { EmployeeSkill, SkillProficiency } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

const proficiencyOptions: SkillProficiency[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT"
];

type EmployeeSkillsPageProps = {
  scope?: "all" | "team";
};

export function EmployeeSkillsPage({ scope = "all" }: EmployeeSkillsPageProps) {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<EmployeeSkill | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["employees", scope, "employee-skills"],
    queryFn: () =>
      scope === "team"
        ? employeesApi.team({ limit: 100 })
        : employeesApi.list({ limit: 100 })
  });
  const skillsQuery = useQuery({
    queryKey: ["skills", "employee-skills"],
    queryFn: () => skillsApi.list({ limit: 100 })
  });
  const employeeSkillsQuery = useQuery({
    queryKey: ["employee-skills", selectedEmployeeId],
    queryFn: () => employeeSkillsApi.list(Number(selectedEmployeeId)),
    enabled: Boolean(selectedEmployeeId)
  });

  const form = useForm({
    initialValues: {
      skillId: "",
      yearsExperience: 0,
      proficiency: "" as SkillProficiency | "",
      lastUsedAt: "",
      note: ""
    },
    validate: {
      skillId: (value) => (value ? null : tx("Required"))
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      if (!selectedEmployeeId) {
        throw new Error(tx("Employee is required"));
      }
      const payload = normalizeEmployeeSkillPayload(values);
      return editing
        ? employeeSkillsApi.update(editing.id, payload)
        : employeeSkillsApi.create(Number(selectedEmployeeId), payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Employee skill saved") });
      queryClient.invalidateQueries({ queryKey: ["employee-skills"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const deleteMutation = useMutation({
    mutationFn: employeeSkillsApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Employee skill removed") });
      queryClient.invalidateQueries({ queryKey: ["employee-skills"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({
      skillId: "",
      yearsExperience: 0,
      proficiency: "",
      lastUsedAt: "",
      note: ""
    });
    setOpened(true);
  }

  function openEdit(item: EmployeeSkill) {
    setEditing(item);
    form.setValues({
      skillId: String(item.skillId),
      yearsExperience: Number(item.yearsExperience ?? 0),
      proficiency: item.proficiency ?? "",
      lastUsedAt: item.lastUsedAt?.slice(0, 10) ?? "",
      note: item.note ?? ""
    });
    setOpened(true);
  }

  const employeeOptions = (employeesQuery.data?.items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.fullName} (${item.employeeCode})`
  }));
  const skillOptions = (skillsQuery.data?.items ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      value: String(item.id),
      label: `${item.code} - ${item.name}`
    }));
  const selectedEmployee = (employeesQuery.data?.items ?? []).find(
    (item) => String(item.id) === selectedEmployeeId
  );

  return (
    <Stack gap="md">
      <PageHeader
        title={scope === "team" ? "Employee Skills" : "Employee Skills"}
        description={
          scope === "team"
            ? "Assign skills, proficiency, and experience to team members."
            : "Assign skills, proficiency, and experience to employee profiles."
        }
        actions={
          <Button
            leftSection={<Plus size={16} />}
            onClick={openCreate}
            disabled={!selectedEmployeeId}
          >
            {tx("New employee skill")}
          </Button>
        }
      />

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label={tx("Employee")}
            data={employeeOptions}
            value={selectedEmployeeId}
            onChange={setSelectedEmployeeId}
            searchable
            clearable
            placeholder={tx("Select employee")}
          />
          <Stack gap={2} justify="flex-end">
            <Text size="sm" c="dimmed">
              {tx("Selected profile")}
            </Text>
            <Text fw={700}>{selectedEmployee?.fullName ?? "-"}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      <DataTable<EmployeeSkill>
        data={employeeSkillsQuery.data ?? []}
        loading={employeeSkillsQuery.isLoading}
        error={
          employeeSkillsQuery.error ? getApiErrorMessage(employeeSkillsQuery.error) : null
        }
        emptyTitle={
          selectedEmployeeId
            ? tx("There is nothing to show for the current filters.")
            : tx("Select employee")
        }
        columns={[
          {
            key: "skill",
            label: "Skill",
            render: (item) => (
              <Stack gap={0}>
                <Text fw={700}>{item.skill.name}</Text>
                <Text size="xs" c="dimmed">
                  {item.skill.code}
                </Text>
              </Stack>
            )
          },
          {
            key: "proficiency",
            label: "Proficiency",
            render: (item) =>
              item.proficiency ? <Badge>{te(item.proficiency)}</Badge> : "-"
          },
          {
            key: "experience",
            label: "Years experience",
            render: (item) => Number(item.yearsExperience ?? 0)
          },
          { key: "lastUsedAt", label: "Last used", render: (item) => formatDate(item.lastUsedAt) },
          { key: "note", label: "Note", render: (item) => item.note ?? "-" },
          {
            key: "actions",
            label: "",
            width: 96,
            render: (item) => (
              <Group gap={4} justify="flex-end">
                <Tooltip label={tx("Edit")}>
                  <ActionIcon variant="subtle" onClick={() => openEdit(item)}>
                    <Edit size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tx("Delete")}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Delete employee skill"),
                        message: `${tx("Delete")} ${item.skill.name}?`,
                        confirmLabel: tx("Delete"),
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
        title={editing ? tx("Edit employee skill") : tx("New employee skill")}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <Select
              label={tx("Skill")}
              data={skillOptions}
              searchable
              required
              {...form.getInputProps("skillId")}
            />
            <NumberInput
              label={tx("Years experience")}
              min={0}
              decimalScale={1}
              {...form.getInputProps("yearsExperience")}
            />
            <Select
              label={tx("Proficiency")}
              data={proficiencyOptions.map((value) => ({ value, label: te(value) }))}
              clearable
              {...form.getInputProps("proficiency")}
            />
            <TextInput label={tx("Last used")} type="date" {...form.getInputProps("lastUsedAt")} />
            <Textarea label={tx("Note")} autosize minRows={3} {...form.getInputProps("note")} />
            <Button type="submit" loading={saveMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function normalizeEmployeeSkillPayload(values: {
  skillId: string;
  yearsExperience: number | string;
  proficiency: SkillProficiency | "";
  lastUsedAt: string;
  note: string;
}) {
  return {
    skillId: Number(values.skillId),
    yearsExperience:
      values.yearsExperience === "" ? undefined : Number(values.yearsExperience),
    proficiency: values.proficiency || undefined,
    lastUsedAt: values.lastUsedAt || undefined,
    note: values.note.trim() || undefined
  };
}
