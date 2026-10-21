// Trang hồ sơ của tôi: xem thông tin, đổi ảnh đại diện, đổi điện thoại / email (cần mã OTP), đổi mật khẩu.

import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
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
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { authApi, employeesApi } from "../../api/endpoints";
import {
  formatCareerLevel,
  formatPositionName,
  formatDate,
  formatDepartmentName
} from "../../api/format";
import { EmployeeAvatarUpload } from "../../components/EmployeeAvatarUpload";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

export function MyProfilePage() {
  const { te, tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: { personalEmail: "", phone: "" } });
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
        personalEmail: query.data.personalEmail ?? "",
        phone: query.data.phone ?? ""
      });
    }
    // Mantine rebuilds `form` on every render, so listing it here would loop
    // forever; the query result is the only real trigger for this sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);
  // A new email or phone waits here until the code emailed for it comes back.
  const [pending, setPending] = useState<{
    values: typeof form.values;
    purpose: "EMAIL_CHANGE" | "PHONE_CHANGE";
    target: string;
    sentTo: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const mutation = useMutation({
    mutationFn: ({ values, otpCode }: { values: typeof form.values; otpCode?: string }) =>
      employeesApi.updateMe({
        personalEmail: values.personalEmail.trim().toLowerCase(),
        phone: values.phone.trim(),
        otpCode
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Profile updated") });
      setPending(null);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  // A new picture needs no code, so it is saved the moment it is picked.
  const avatarMutation = useMutation({
    mutationFn: (avatarUrl: string | null) => employeesApi.updateMe({ avatarUrl }),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Profile photo updated") });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const sendCode = useMutation({
    mutationFn: (request: { purpose: "EMAIL_CHANGE" | "PHONE_CHANGE"; target: string; values: typeof form.values }) =>
      authApi.requestVerificationCode(request.purpose, request.target).then((sent) => ({ sent, request })),
    onSuccess: ({ sent, request }) => {
      setPending({ ...request, sentTo: sent.sentTo });
      setCode("");
      setResendIn(sent.resendAfterSeconds);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  /** A new email or phone needs the emailed code first. */
  function save(values: typeof form.values) {
    const email = values.personalEmail.trim().toLowerCase();
    const phone = values.phone.trim();
    const emailChanged = email !== (query.data?.personalEmail ?? "").toLowerCase();
    const phoneChanged = phone !== (query.data?.phone ?? "");
    if (emailChanged && phoneChanged) {
      notifications.show({ color: "red", message: tx("Change the email and the phone one at a time") });
      return;
    }
    if (!emailChanged && !phoneChanged) {
      notifications.show({ color: "blue", message: tx("Nothing to save") });
      return;
    }
    sendCode.mutate({
      purpose: emailChanged ? "EMAIL_CHANGE" : "PHONE_CHANGE",
      target: emailChanged ? email : phone,
      values
    });
  }

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
      <div className="profile-layout">
        <Paper withBorder radius="md" p="md">
          <Stack gap="md" align="center">
            <EmployeeAvatarUpload
              value={profile?.avatarUrl}
              fullName={profile?.fullName}
              onChange={(value) => avatarMutation.mutate(value)}
            />
            <Stack gap={4} align="center">
              <Text fw={800} size="lg" ta="center">{profile?.fullName ?? "-"}</Text>
              <Text size="sm" c="dimmed" ta="center">{formatPositionName(profile) || "-"}</Text>
              <Group gap={4} justify="center">
                {roles.map((role) => (
                  <Badge key={role} variant="light">{role}</Badge>
                ))}
              </Group>
            </Stack>
          </Stack>
        </Paper>
        <Stack gap="md">
          <Paper withBorder radius="md" p="md">
            <Text fw={800} mb="sm">{tx("Work information")}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" verticalSpacing="md">
              <Info label={tx("Username")} value={accountQuery.data?.username} />
              <Info label={tx("Employee code")} value={profile?.employeeCode} />
              <Info label={tx("Department")} value={formatDepartmentName(profile?.department, tx)} />
              <Info
                label={tx("Career level")}
                value={formatCareerLevel(profile?.careerLevel, te)}
              />
              <Info label={tx("Status")} value={profile?.status ? tx(profile.status) : undefined} />
              <Info label={tx("Birth date")} value={formatDate(profile?.birthDate)} />
              <Info label={tx("Hire date")} value={formatDate(profile?.hireDate)} />
            </SimpleGrid>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <form onSubmit={form.onSubmit(save)}>
              <Stack gap="sm">
                <Text fw={800}>{tx("Contact details")}</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput label={tx("Email")} description={tx("Also your login email; a code is sent to the new address")} {...form.getInputProps("personalEmail")} />
                  <TextInput label={tx("Phone")} description={tx("A code is sent to your email to confirm")} {...form.getInputProps("phone")} />
                </SimpleGrid>
                <Group justify="flex-end">
                  <Button type="submit" leftSection={<Save size={16} />} loading={mutation.isPending || sendCode.isPending}>{tx("Save profile")}</Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </div>
      <Modal
        opened={Boolean(pending)}
        onClose={() => setPending(null)}
        title={tx("Enter the verification code")}
        centered
      >
        <Stack>
          <Text size="sm">
            {tx("A 6-digit code was sent to")} <b>{pending?.sentTo}</b>. {tx("It is valid for 10 minutes.")}
          </Text>
          <TextInput
            label={tx("Verification code")}
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            data-autofocus
          />
          <Group justify="space-between">
            <Button
              variant="subtle"
              disabled={resendIn > 0 || !pending}
              loading={sendCode.isPending}
              onClick={() => pending && sendCode.mutate(pending)}
            >
              {resendIn > 0 ? `${tx("Resend code")} (${resendIn}s)` : tx("Resend code")}
            </Button>
            <Button
              disabled={code.length !== 6}
              loading={mutation.isPending}
              onClick={() => pending && mutation.mutate({ values: pending.values, otpCode: code })}
            >
              {tx("Confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
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
