import { Button, Paper, Stack, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { dashboardApi } from "../../api/endpoints";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function SystemSettingsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: { settings: "{}" } });
  const query = useQuery({ queryKey: ["system-settings"], queryFn: dashboardApi.settings });

  useEffect(() => {
    if (query.data) {
      form.setFieldValue("settings", JSON.stringify(query.data, null, 2));
    }
  }, [form, query.data]);

  const mutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) => dashboardApi.updateSettings(settings),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Settings saved") });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  return (
    <Stack gap="md">
      <PageHeader title="System Settings" description="Simple phase 1 settings placeholder." />
      <Paper withBorder radius="md" p="md">
        <form
          onSubmit={form.onSubmit((values) => {
            try {
              mutation.mutate(JSON.parse(values.settings));
            } catch {
              notifications.show({ color: "red", message: tx("Settings must be valid JSON") });
            }
          })}
        >
          <Stack>
            <Textarea label={tx("Settings JSON")} autosize minRows={10} {...form.getInputProps("settings")} />
            <Button type="submit" leftSection={<Save size={16} />} loading={mutation.isPending}>{tx("Save settings")}</Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
