import { ActionIcon, Badge, Button, Group, Modal, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { reviewCyclesApi } from "../../api/endpoints";
import { formatDate } from "../../api/format";
import type { ReviewCycle } from "../../api/types";
import { openConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

function statusColor(status: ReviewCycle["status"]) {
  return status === "OPEN" ? "green" : "gray";
}

export function ReviewCyclesPage() {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const query = useQuery({ queryKey: ["review-cycles"], queryFn: reviewCyclesApi.list });
  const form = useForm({ initialValues: { name: "", startDate: "", endDate: "" } });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) => reviewCyclesApi.create(values),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Review cycle created") });
      queryClient.invalidateQueries({ queryKey: ["review-cycles"] });
      setOpened(false);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const launchMutation = useMutation({
    mutationFn: (id: number) => reviewCyclesApi.launch(id),
    onSuccess: (result) => {
      notifications.show({
        color: "green",
        message: `${tx("Review cycle launched")}: ${result.createdCount} ${tx("reviews created")}`
      });
      queryClient.invalidateQueries({ queryKey: ["review-cycles"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => reviewCyclesApi.update(id, { status: "CLOSED" }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Review cycle closed") });
      queryClient.invalidateQueries({ queryKey: ["review-cycles"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  function openCreate() {
    form.setValues({ name: "", startDate: "", endDate: "" });
    setOpened(true);
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Review Cycles"
        description="Create review cycles and launch performance reviews for all employees."
        actions={
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            {tx("New review cycle")}
          </Button>
        }
      />
      <DataTable<ReviewCycle>
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error) : null}
        columns={[
          { key: "name", label: "Name", render: (item) => <Text fw={700}>{item.name}</Text> },
          { key: "dates", label: "Dates", render: (item) => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` },
          {
            key: "status",
            label: "Status",
            render: (item) => <Badge color={statusColor(item.status)}>{te(item.status)}</Badge>
          },
          {
            key: "actions",
            label: "",
            render: (item) => (
              <Group justify="flex-end" gap={4}>
                {item.status === "OPEN" ? (
                  <>
                    <Tooltip label={tx("Launch")}>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        loading={launchMutation.isPending}
                        onClick={() =>
                          openConfirmModal({
                            title: tx("Launch review cycle"),
                            message: tx(
                              "Create a performance review for every active employee in this cycle."
                            ),
                            confirmLabel: tx("Launch"),
                            onConfirm: () => launchMutation.mutate(item.id)
                          })
                        }
                      >
                        <Play size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={tx("Close cycle")}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() =>
                          openConfirmModal({
                            title: tx("Close cycle"),
                            message: tx("Close this review cycle?"),
                            confirmLabel: tx("Close cycle"),
                            onConfirm: () => closeMutation.mutate(item.id)
                          })
                        }
                      >
                        <Text size="xs">✕</Text>
                      </ActionIcon>
                    </Tooltip>
                  </>
                ) : null}
              </Group>
            )
          }
        ]}
      />
      <Modal opened={opened} onClose={() => setOpened(false)} title={tx("New review cycle")}>
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <TextInput label={tx("Name")} required {...form.getInputProps("name")} />
            <TextInput
              label={tx("Start date")}
              type="date"
              required
              {...form.getInputProps("startDate")}
            />
            <TextInput
              label={tx("End date")}
              type="date"
              required
              {...form.getInputProps("endDate")}
            />
            <Button type="submit" loading={createMutation.isPending}>
              {tx("Save")}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
