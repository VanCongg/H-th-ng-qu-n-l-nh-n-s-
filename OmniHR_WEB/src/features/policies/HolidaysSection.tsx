import { ActionIcon, Button, Group, Modal, Paper, Select, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { holidaysApi } from "../../api/endpoints";
import { formatDate } from "../../api/format";
import type { Holiday } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { useTranslation } from "../../i18n";

/**
 * Public holidays and compensatory days off, kept with the other policies they
 * belong to. They are not working days anywhere: leave over them costs
 * nothing, nobody is absent on them, and the mobile calendar marks them.
 */
export function HolidaysSection() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const query = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => holidaysApi.list(Number(year))
  });
  const form = useForm({
    initialValues: { date: "", name: "" },
    validate: {
      date: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? null : tx("Required")),
      name: (value) => (value.trim() ? null : tx("Required"))
    }
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["holidays"] });
  const saveMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      editing ? holidaysApi.update(editing.id, values) : holidaysApi.create(values),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Holiday saved") });
      refresh();
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const deleteMutation = useMutation({
    mutationFn: holidaysApi.remove,
    onSuccess: refresh,
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    setEditing(null);
    form.setValues({ date: "", name: "" });
    setOpened(true);
  }
  function openEdit(item: Holiday) {
    setEditing(item);
    form.setValues({ date: item.date.slice(0, 10), name: item.name });
    setOpened(true);
  }

  const yearOptions = [thisYear - 1, thisYear, thisYear + 1].map((value) => ({
    value: String(value),
    label: String(value)
  }));

  return (
    <Paper withBorder radius="md" p="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={3}>{tx("7. Public holidays")}</Title>
            <Text c="dimmed">
              {tx("Public holidays and compensatory days off: not working days for leave, attendance or tasks.")}
            </Text>
          </Stack>
          <Group gap="xs">
            <Select data={yearOptions} value={year} onChange={(value) => value && setYear(value)} w={110} allowDeselect={false} />
            <Button leftSection={<Plus size={16} />} onClick={openCreate}>{tx("New holiday")}</Button>
          </Group>
        </Group>
        <DataTable<Holiday>
          data={query.data ?? []}
          loading={query.isLoading}
          error={query.error ? getApiErrorMessage(query.error) : null}
          columns={[
            { key: "date", label: "Date", render: (item) => <Text fw={700}>{formatDate(item.date)}</Text> },
            { key: "name", label: "Name", render: (item) => item.name },
            {
              key: "actions",
              label: "",
              render: (item) => (
                <Group justify="flex-end" gap={4}>
                  <Tooltip label={tx("Edit")}><ActionIcon variant="subtle" onClick={() => openEdit(item)}><Edit size={16} /></ActionIcon></Tooltip>
                  <Tooltip label={tx("Delete")}>
                    <ActionIcon variant="subtle" color="red" onClick={() => openConfirmModal({
                      title: tx("Delete holiday"),
                      message: `${tx("Delete")} ${item.name} (${formatDate(item.date)})?`,
                      confirmLabel: tx("Delete"),
                      onConfirm: () => deleteMutation.mutate(item.id)
                    })}><Trash2 size={16} /></ActionIcon>
                  </Tooltip>
                </Group>
              )
            }
          ]}
        />
        <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? tx("Edit holiday") : tx("New holiday")}>
          <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
            <Stack>
              <TextInput type="date" label={tx("Date")} required {...form.getInputProps("date")} />
              <TextInput label={tx("Name")} required placeholder={tx("e.g. Tết Nguyên đán")} {...form.getInputProps("name")} />
              <Button type="submit" loading={saveMutation.isPending}>{tx("Save")}</Button>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Paper>
  );
}
