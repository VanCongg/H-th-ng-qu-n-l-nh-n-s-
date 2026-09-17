import { List, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { ClipboardCheck, FileText } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

const policySections = [
  {
    title: "1. Account and permission policy",
    body:
      "Every employee has one system account linked to their employee profile. Access is assigned by roles such as Admin, Manager, and Employee. Admin manages all data; Manager only views and processes data within subordinate scope; Employee mainly uses personal workflows."
  },
  {
    title: "2. Employee profile policy",
    body:
      "Employee profiles should be kept accurate for department, position, company email, employment status, and contact details. Important changes should be performed by Admin to keep HR data consistent."
  },
  {
    title: "3. Attendance policy",
    body:
      "Employees check in and check out by work date. If attendance is missed, has incorrect time, or needs additional data, Admin can create an adjustment record with a reason for later review."
  },
  {
    title: "4. Leave policy",
    body:
      "Employees create leave requests by selecting leave type, start date, end date, and reason. The system calculates leave days by work days and prevents overlapping pending or approved requests. Manager or Admin approves or rejects according to responsibility scope."
  }
];

const dataPrinciples = [
  "Do not share accounts with other people.",
  "HR data must be updated from an accurate source.",
  "Important operations are recorded in system audit logs.",
  "Personal information may only be viewed within the authorized scope."
];

export function PoliciesPage() {
  const { tx } = useTranslation();

  return (
    <Stack gap="md">
      <PageHeader
        title="Policies"
        description="Internal policy reference for admins and managers."
      />

      <Paper withBorder radius="md" p="xl" className="policy-document">
        <Stack gap="lg">
          <Stack gap={6}>
            <ThemeIcon size={44} radius="md" variant="light" color="blue">
              <FileText size={24} />
            </ThemeIcon>
            <Title order={2}>{tx("OmniHR operating policy")}</Title>
            <Text c="dimmed">
              {tx(
                "This document describes current operating principles for the HR system. It is guidance content, not a dynamic permission configuration screen."
              )}
            </Text>
          </Stack>

          {policySections.map((section) => (
            <Stack key={section.title} gap="xs">
              <Title order={3}>{tx(section.title)}</Title>
              <Text>{tx(section.body)}</Text>
            </Stack>
          ))}

          <Stack gap="xs">
            <Title order={3}>{tx("5. Data handling principles")}</Title>
            <List spacing="xs" icon={<ClipboardCheck size={16} />}>
              {dataPrinciples.map((principle) => (
                <List.Item key={principle}>{tx(principle)}</List.Item>
              ))}
            </List>
          </Stack>

          <Stack gap="xs">
            <Title order={3}>{tx("6. System settings note")}</Title>
            <Text>
              {tx(
                "Settings such as work days, leave calculation, and phase configuration are managed in System Settings. When changing settings, Admin should review business impact before applying them company-wide."
              )}
            </Text>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
