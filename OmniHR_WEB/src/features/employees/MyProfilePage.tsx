import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { authApi, employeesApi } from "../../api/endpoints";
import {
  formatCareerLevel,
  formatDate,
  formatDepartmentName,
  formatEmployeeJobTitle
} from "../../api/format";
import { EmployeeAvatar } from "../../components/EmployeeAvatar";
import { EmployeeAvatarUpload } from "../../components/EmployeeAvatarUpload";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function MyProfilePage() {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: { avatarUrl: "", personalEmail: "", phone: "" } });
  const query = useQuery({
    queryKey: ["my-profile"],
    queryFn: employeesApi.me
  });
  const accountQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: authApi.me
  });

  useEffect(() => {
    if (query.data) {
      form.setValues({
        avatarUrl: query.data.avatarUrl ?? "",
        personalEmail: query.data.personalEmail ?? "",
        phone: query.data.phone ?? ""
      });
    }
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      employeesApi.updateMe({
        ...values,
        avatarUrl: values.avatarUrl.trim() || null
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Profile updated") });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const profile = query.data;
  const roles = accountQuery.data?.roles ?? [];

  return (
    <Stack gap="md">
      <PageHeader title="My Profile" description="View your HR profile and update contact details." />
      {query.isLoading ? (
        <Paper withBorder radius="md" p="md">
          <Group justify="center">
            <Loader size="sm" />
          </Group>
        </Paper>
      ) : null}
      {query.error ? (
        <Alert color="red">{getApiErrorMessage(query.error)}</Alert>
      ) : null}
      <Paper withBorder radius="md" p="md">
        <Group align="flex-start" gap="md" wrap="nowrap">
          <EmployeeAvatar employee={profile} size={64} />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} style={{ flex: 1 }}>
            <Info label={tx("Username")} value={accountQuery.data?.username} />
            <Info label={tx("Account email")} value={accountQuery.data?.email} />
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{tx("Roles")}</Text>
              <Group gap={4}>
                {roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
                {!roles.length ? <Text fw={700}>-</Text> : null}
              </Group>
            </Stack>
          </SimpleGrid>
        </Group>
      </Paper>
      <Paper withBorder radius="md" p="md">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <Info label={tx("Employee code")} value={profile?.employeeCode} />
          <Info label={tx("Full name")} value={profile?.fullName} />
          <Info label={tx("Company email")} value={profile?.companyEmail} />
          <Info label={tx("Department")} value={formatDepartmentName(profile?.department, tx)} />
          <Info label={tx("Position")} value={formatEmployeeJobTitle(profile, te)} />
          <Info
            label={tx("Career level")}
            value={formatCareerLevel(profile?.careerLevel, te)}
          />
          <Info label={tx("Status")} value={profile?.status ? tx(profile.status) : undefined} />
          <Info label={tx("Birth date")} value={formatDate(profile?.birthDate)} />
          <Info label={tx("Hire date")} value={formatDate(profile?.hireDate)} />
          <Info label={tx("Personal email")} value={profile?.personalEmail} />
          <Info label={tx("Phone")} value={profile?.phone} />
        </SimpleGrid>
      </Paper>
      <Paper withBorder radius="md" p="md">
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack>
            <div className="employee-form-layout">
              <EmployeeAvatarUpload
                value={form.values.avatarUrl}
                fullName={profile?.fullName}
                onChange={(value) => form.setFieldValue("avatarUrl", value ?? "")}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label={tx("Personal email")} {...form.getInputProps("personalEmail")} />
                <TextInput label={tx("Phone")} {...form.getInputProps("phone")} />
              </SimpleGrid>
            </div>
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
