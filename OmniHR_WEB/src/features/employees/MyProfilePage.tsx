import { Button, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { employeesApi } from "../../api/endpoints";
import { formatDate } from "../../api/format";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function MyProfilePage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: { personalEmail: "", phone: "" } });
  const query = useQuery({
    queryKey: ["my-profile"],
    queryFn: employeesApi.me
  });

  useEffect(() => {
    if (query.data) {
      form.setValues({
        personalEmail: query.data.personalEmail ?? "",
        phone: query.data.phone ?? ""
      });
    }
  }, [form, query.data]);
  const mutation = useMutation({
    mutationFn: (values: typeof form.values) => employeesApi.updateMe(values),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Profile updated") });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const profile = query.data;

  return (
    <Stack gap="md">
      <PageHeader title="My Profile" description="View your HR profile and update contact details." />
      <Paper withBorder radius="md" p="md">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <Info label={tx("Employee code")} value={profile?.employeeCode} />
          <Info label={tx("Full name")} value={profile?.fullName} />
          <Info label={tx("Company email")} value={profile?.companyEmail} />
          <Info label={tx("Department")} value={profile?.department?.name} />
          <Info label={tx("Position")} value={profile?.position?.name} />
          <Info label={tx("Birth date")} value={formatDate(profile?.birthDate)} />
        </SimpleGrid>
      </Paper>
      <Paper withBorder radius="md" p="md">
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label={tx("Personal email")} {...form.getInputProps("personalEmail")} />
              <TextInput label={tx("Phone")} {...form.getInputProps("phone")} />
            </SimpleGrid>
            <Button type="submit" leftSection={<Save size={16} />} loading={mutation.isPending}>{tx("Save profile")}</Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text fw={700}>{value || "-"}</Text>
    </Stack>
  );
}
