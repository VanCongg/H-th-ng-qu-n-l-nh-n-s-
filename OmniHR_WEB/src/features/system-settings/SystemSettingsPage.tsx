import {
  Button,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  TextInput
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { dashboardApi } from "../../api/endpoints";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";

type SettingsFormValues = {
  companyName: string;
  companyAddress: string;
  companyLatitude: string;
  companyLongitude: string;
  attendanceRadiusMeters: number;
  requireAttendanceLocation: boolean;
  timezoneOffsetMinutes: number;
  attendanceEarlyCheckInMinutes: number;
  morningShiftStart: string;
  morningShiftEnd: string;
  afternoonShiftStart: string;
  afternoonShiftEnd: string;
};

const initialValues: SettingsFormValues = {
  companyName: "OmniHR",
  companyAddress: "",
  companyLatitude: "",
  companyLongitude: "",
  attendanceRadiusMeters: 100,
  requireAttendanceLocation: true,
  timezoneOffsetMinutes: 420,
  attendanceEarlyCheckInMinutes: 60,
  morningShiftStart: "08:00",
  morningShiftEnd: "12:00",
  afternoonShiftStart: "13:00",
  afternoonShiftEnd: "17:00"
};

export function SystemSettingsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<SettingsFormValues>({
    initialValues,
    validate: {
      companyLatitude: (value) =>
        validateCoordinate(value, -90, 90, tx("Invalid coordinate")),
      companyLongitude: (value) =>
        validateCoordinate(value, -180, 180, tx("Invalid coordinate"))
    }
  });
  const query = useQuery({
    queryKey: ["system-settings"],
    queryFn: dashboardApi.settings
  });

  useEffect(() => {
    if (query.data) {
      form.setValues(settingsToFormValues(query.data));
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      dashboardApi.updateSettings(settings),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Settings saved") });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error) =>
      notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="System Settings"
        description="Configure company attendance policy."
      />
      <Paper withBorder radius="md" p="md">
        <form
          onSubmit={form.onSubmit((values) =>
            mutation.mutate({
              ...values,
              companyLatitude: nullableNumber(values.companyLatitude),
              companyLongitude: nullableNumber(values.companyLongitude)
            })
          )}
        >
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label={tx("Company name")}
                required
                {...form.getInputProps("companyName")}
              />
              <TextInput
                label={tx("Company address")}
                {...form.getInputProps("companyAddress")}
              />
              <TextInput
                label={tx("Company latitude")}
                placeholder="21.02776"
                {...form.getInputProps("companyLatitude")}
              />
              <TextInput
                label={tx("Company longitude")}
                placeholder="105.83416"
                {...form.getInputProps("companyLongitude")}
              />
              <NumberInput
                label={tx("Attendance radius")}
                min={1}
                suffix=" m"
                required
                {...form.getInputProps("attendanceRadiusMeters")}
              />
              <NumberInput
                label={tx("Early check-in window")}
                min={0}
                max={240}
                suffix=" min"
                required
                {...form.getInputProps("attendanceEarlyCheckInMinutes")}
              />
              <TextInput
                label={tx("Morning shift start")}
                type="time"
                required
                {...form.getInputProps("morningShiftStart")}
              />
              <TextInput
                label={tx("Morning shift end")}
                type="time"
                required
                {...form.getInputProps("morningShiftEnd")}
              />
              <TextInput
                label={tx("Afternoon shift start")}
                type="time"
                required
                {...form.getInputProps("afternoonShiftStart")}
              />
              <TextInput
                label={tx("Afternoon shift end")}
                type="time"
                required
                {...form.getInputProps("afternoonShiftEnd")}
              />
              <NumberInput
                label={tx("Timezone offset")}
                min={-720}
                max={840}
                required
                {...form.getInputProps("timezoneOffsetMinutes")}
              />
              <Switch
                label={tx("Require attendance location")}
                {...form.getInputProps("requireAttendanceLocation", {
                  type: "checkbox"
                })}
              />
            </SimpleGrid>
            <Button
              type="submit"
              leftSection={<Save size={16} />}
              loading={mutation.isPending}
            >
              {tx("Save settings")}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

function formatNullableNumber(value: unknown) {
  return typeof value === "number" ? String(value) : "";
}

function settingsToFormValues(settings: Record<string, unknown>): SettingsFormValues {
  return {
    companyName: stringValue(settings.companyName, initialValues.companyName),
    companyAddress: stringValue(
      settings.companyAddress,
      initialValues.companyAddress
    ),
    companyLatitude: formatNullableNumber(settings.companyLatitude),
    companyLongitude: formatNullableNumber(settings.companyLongitude),
    attendanceRadiusMeters: numberValue(
      settings.attendanceRadiusMeters,
      initialValues.attendanceRadiusMeters
    ),
    requireAttendanceLocation: booleanValue(
      settings.requireAttendanceLocation,
      initialValues.requireAttendanceLocation
    ),
    timezoneOffsetMinutes: numberValue(
      settings.timezoneOffsetMinutes,
      initialValues.timezoneOffsetMinutes
    ),
    attendanceEarlyCheckInMinutes: numberValue(
      settings.attendanceEarlyCheckInMinutes,
      initialValues.attendanceEarlyCheckInMinutes
    ),
    morningShiftStart: stringValue(
      settings.morningShiftStart,
      initialValues.morningShiftStart
    ),
    morningShiftEnd: stringValue(
      settings.morningShiftEnd,
      initialValues.morningShiftEnd
    ),
    afternoonShiftStart: stringValue(
      settings.afternoonShiftStart,
      initialValues.afternoonShiftStart
    ),
    afternoonShiftEnd: stringValue(
      settings.afternoonShiftEnd,
      initialValues.afternoonShiftEnd
    )
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function validateCoordinate(
  value: string,
  min: number,
  max: number,
  message: string
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? null
    : message;
}
