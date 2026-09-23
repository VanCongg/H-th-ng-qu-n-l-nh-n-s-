import {
  Alert,
  Button,
  Checkbox,
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
import { Save, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { dashboardApi } from "../../api/endpoints";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { CompanyLocationPicker } from "./CompanyLocationPicker";

type SettingsFormValues = {
  companyName: string;
  companyAddress: string;
  companyLatitude: number | null;
  companyLongitude: number | null;
  attendanceRadiusMeters: number;
  requireAttendanceLocation: boolean;
  timezoneOffsetMinutes: number;
  attendanceEarlyCheckInMinutes: number;
  attendanceGraceMinutes: number;
  seniorityLeaveEveryYears: number;
  aiWeightSkill: number;
  aiWeightWorkload: number;
  aiWeightAvailability: number;
  aiWeightHistory: number;
  annualLeaveCarryOverMaxDays: number;
  morningShiftStart: string;
  morningShiftEnd: string;
  afternoonShiftStart: string;
  afternoonShiftEnd: string;
  workWeek: string[];
};

const WORK_WEEK_DAYS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" }
];

const initialValues: SettingsFormValues = {
  companyName: "OmniHR",
  companyAddress: "",
  companyLatitude: null,
  companyLongitude: null,
  attendanceRadiusMeters: 100,
  requireAttendanceLocation: true,
  timezoneOffsetMinutes: 420,
  attendanceEarlyCheckInMinutes: 60,
  attendanceGraceMinutes: 0,
  seniorityLeaveEveryYears: 5,
  aiWeightSkill: 0.1,
  aiWeightWorkload: 0.15,
  aiWeightAvailability: 0.1,
  aiWeightHistory: 0.65,
  annualLeaveCarryOverMaxDays: 5,
  morningShiftStart: "08:00",
  morningShiftEnd: "12:00",
  afternoonShiftStart: "13:00",
  afternoonShiftEnd: "17:00",
  workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
};

export function SystemSettingsPage() {
  const { tx } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<SettingsFormValues>({
    initialValues,
    validate: {
      workWeek: (value) =>
        value.length > 0 ? null : tx("Select at least one working day")
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
    // Mantine rebuilds `form` on every render, so listing it here would loop
    // forever; the query result is the only real trigger for this sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The server skips the radius check when it has no company coordinates, so
  // this combination silently accepts every check-in.
  const geofenceInert =
    form.values.requireAttendanceLocation &&
    (form.values.companyLatitude === null ||
      form.values.companyLongitude === null);

  return (
    <Stack gap="md">
      <PageHeader
        title="System Settings"
        description="Configure company attendance policy."
      />
      <Paper withBorder radius="md" p="md">
        <form
          onSubmit={form.onSubmit((values) => mutation.mutate({ ...values }))}
        >
          <Stack>
            <Checkbox.Group
              label={tx("Working days")}
              description={tx(
                "Days outside this list are not counted as leave days"
              )}
              {...form.getInputProps("workWeek")}
            >
              <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }} mt="xs">
                {WORK_WEEK_DAYS.map((day) => (
                  <Checkbox key={day.value} value={day.value} label={tx(day.label)} />
                ))}
              </SimpleGrid>
            </Checkbox.Group>
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
              <NumberInput
                label={tx("Grace period")}
                description={tx(
                  "Late arrival or early leave within this many minutes is not deducted"
                )}
                min={0}
                max={120}
                suffix=" min"
                required
                {...form.getInputProps("attendanceGraceMinutes")}
              />
              <NumberInput
                label={tx("Seniority leave step")}
                description={tx(
                  "One extra annual leave day per this many full years of service (0 turns it off)"
                )}
                min={0}
                max={10}
                suffix={` ${tx("years")}`}
                required
                {...form.getInputProps("seniorityLeaveEveryYears")}
              />
              <NumberInput
                label={tx("Carry-over limit")}
                description={tx(
                  "Unused annual leave days that roll into the next year (0 turns it off)"
                )}
                min={0}
                max={30}
                suffix={` ${tx("days")}`}
                required
                {...form.getInputProps("annualLeaveCarryOverMaxDays")}
              />
              <NumberInput
                label={tx("AI weight: skill")}
                description={tx(
                  "Fitted on past assignments by the weight tuning script; the scorer renormalises them"
                )}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                required
                {...form.getInputProps("aiWeightSkill")}
              />
              <NumberInput
                label={tx("AI weight: workload")}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                required
                {...form.getInputProps("aiWeightWorkload")}
              />
              <NumberInput
                label={tx("AI weight: leave availability")}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                required
                {...form.getInputProps("aiWeightAvailability")}
              />
              <NumberInput
                label={tx("AI weight: track record")}
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                required
                {...form.getInputProps("aiWeightHistory")}
              />
              <Switch
                label={tx("Require attendance location")}
                {...form.getInputProps("requireAttendanceLocation", {
                  type: "checkbox"
                })}
              />
            </SimpleGrid>
            {geofenceInert && (
              <Alert
                color="red"
                variant="light"
                icon={<TriangleAlert size={18} />}
                title={tx("Attendance radius is not being enforced")}
              >
                {tx(
                  "\"Require attendance location\" is on, but no company location is set. Until a point is placed on the map below, check-ins are accepted from anywhere and only the coordinates are recorded."
                )}
              </Alert>
            )}
            <CompanyLocationPicker
              latitude={form.values.companyLatitude}
              longitude={form.values.companyLongitude}
              radiusMeters={form.values.attendanceRadiusMeters}
              onChange={(latitude, longitude) =>
                form.setValues({
                  companyLatitude: latitude,
                  companyLongitude: longitude
                })
              }
            />
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

function settingsToFormValues(settings: Record<string, unknown>): SettingsFormValues {
  return {
    companyName: stringValue(settings.companyName, initialValues.companyName),
    companyAddress: stringValue(
      settings.companyAddress,
      initialValues.companyAddress
    ),
    companyLatitude: nullableNumberValue(settings.companyLatitude),
    companyLongitude: nullableNumberValue(settings.companyLongitude),
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
    attendanceGraceMinutes: numberValue(
      settings.attendanceGraceMinutes,
      initialValues.attendanceGraceMinutes
    ),
    aiWeightSkill: numberValue(settings.aiWeightSkill, initialValues.aiWeightSkill),
    aiWeightWorkload: numberValue(
      settings.aiWeightWorkload,
      initialValues.aiWeightWorkload
    ),
    aiWeightAvailability: numberValue(
      settings.aiWeightAvailability,
      initialValues.aiWeightAvailability
    ),
    aiWeightHistory: numberValue(
      settings.aiWeightHistory,
      initialValues.aiWeightHistory
    ),
    seniorityLeaveEveryYears: numberValue(
      settings.seniorityLeaveEveryYears,
      initialValues.seniorityLeaveEveryYears
    ),
    annualLeaveCarryOverMaxDays: numberValue(
      settings.annualLeaveCarryOverMaxDays,
      initialValues.annualLeaveCarryOverMaxDays
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
    ),
    workWeek: stringArrayValue(settings.workWeek, initialValues.workWeek)
  };
}

function stringArrayValue(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : fallback;
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

function nullableNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
