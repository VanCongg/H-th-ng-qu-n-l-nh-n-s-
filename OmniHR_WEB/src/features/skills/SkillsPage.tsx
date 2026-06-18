import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
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
import { positionsApi, skillsApi } from "../../api/endpoints";
import type { Skill } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function SkillsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const skillsQuery = useQuery({
    queryKey: ["skills", search, category, page],
    queryFn: () =>
      skillsApi.list({
        search: search || undefined,
        category: category || undefined,
        page,
        limit: 20
      })
  });
  const positionsQuery = useQuery({
    queryKey: ["positions", "skill-form"],
    queryFn: () => positionsApi.list()
  });

  const form = useForm({
    initialValues: {
      code: "",
      name: "",
      category: "",
      description: "",
      isActive: "true",
      positionIds: [] as string[]
    },
    validate: {
      code: (value) => (value.trim() ? null : tx("Required")),
      name: (value) => (value.trim() ? null : tx("Required"))
    }
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) => {
      const payload = normalizeSkillPayload(values);
      return editing ? skillsApi.update(editing.id, payload) : skillsApi.create(payload);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Skill saved") });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      setOpened(false);
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const deleteMutation = useMutation({
    mutationFn: skillsApi.remove,
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Skill disabled") });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({
      code: "",
      name: "",
      category: "",
      description: "",
      isActive: "true",
      positionIds: []
    });
    setOpened(true);
  }

  function openEdit(item: Skill) {
    setEditing(item);
    form.setValues({
      code: item.code,
      name: item.name,
      category: item.category ?? "",
      description: item.description ?? "",
      isActive: String(item.isActive),
      positionIds:
        item.positionSkills?.map((positionSkill) =>
          String(positionSkill.positionId)
        ) ?? []
    });
    setOpened(true);
  }

  const categoryOptions = Array.from(
    new Set((skillsQuery.data?.items ?? []).map((item) => item.category).filter(Boolean))
  ).map((value) => ({ value: String(value), label: String(value) }));
  const positionOptions = (positionsQuery.data ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} - ${item.name}`
  }));

  return (
    <Stack gap="md">
      <PageHeader
        title="Skills"
        description="Maintain the skill catalog used by task requirements and AI suggestions."
        actions={
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            {tx("New skill")}
          </Button>
        }
      />

      <Paper withBorder radius="md" p="md" className="filter-bar">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={tx("Search")}
            placeholder={tx("Search by name or code")}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label={tx("Category")}
            data={categoryOptions}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
            clearable
            searchable
          />
        </SimpleGrid>
      </Paper>

      <DataTable<Skill>
        data={skillsQuery.data?.items ?? []}
        loading={skillsQuery.isLoading}
        error={skillsQuery.error ? getApiErrorMessage(skillsQuery.error) : null}
        total={skillsQuery.data?.meta.total}
        limit={skillsQuery.data?.meta.limit}
        page={skillsQuery.data?.meta.page}
        onPageChange={setPage}
        columns={[
          { key: "code", label: "Code", render: (item) => <Text fw={700}>{item.code}</Text> },
          { key: "name", label: "Name", render: (item) => item.name },
          { key: "category", label: "Category", render: (item) => item.category ?? "-" },
          {
            key: "positions",
            label: "Related positions",
            render: (item) =>
              item.positionSkills?.length ? (
                <Group gap={4}>
                  {item.positionSkills.slice(0, 3).map((positionSkill) => (
                    <Badge key={positionSkill.positionId} variant="light">
                      {positionSkill.position.code}
                    </Badge>
                  ))}
                  {item.positionSkills.length > 3 ? (
                    <Badge variant="outline">+{item.positionSkills.length - 3}</Badge>
                  ) : null}
                </Group>
              ) : (
                "-"
              )
          },
          {
            key: "active",
            label: "Active",
            render: (item) => (
              <Badge color={item.isActive ? "green" : "gray"}>
                {item.isActive ? tx("Yes") : tx("No")}
              </Badge>
            )
          },
          { key: "description", label: "Description", render: (item) => item.description ?? "-" },
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
                <Tooltip label={tx("Disable")}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() =>
                      openConfirmModal({
                        title: tx("Disable skill"),
                        message: `${tx("Disable")} ${item.name}?`,
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
        title={editing ? tx("Edit skill") : tx("New skill")}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Code")} required {...form.getInputProps("code")} />
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <TextInput label={tx("Category")} {...form.getInputProps("category")} />
            <MultiSelect
              label={tx("Related positions")}
              data={positionOptions}
              searchable
              clearable
              {...form.getInputProps("positionIds")}
            />
            <Select
              label={tx("Active")}
              data={[
                { value: "true", label: tx("Yes") },
                { value: "false", label: tx("No") }
              ]}
              allowDeselect={false}
              {...form.getInputProps("isActive")}
            />
            <Textarea
              label={tx("Description")}
              autosize
              minRows={3}
              {...form.getInputProps("description")}
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

function normalizeSkillPayload(values: {
  code: string;
  name: string;
  category: string;
  description: string;
  isActive: string;
  positionIds: string[];
}) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    category: values.category.trim() || undefined,
    description: values.description.trim() || undefined,
    isActive: values.isActive === "true",
    positionIds: values.positionIds.map(Number)
  };
}
