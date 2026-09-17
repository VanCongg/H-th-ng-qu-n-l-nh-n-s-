import { Stack, Text } from "@mantine/core";
import { formatCareerLevel } from "../../api/format";
import type { Employee } from "../../api/types";
import { useTranslation } from "../../i18n";

type PositionLabelProps = {
  employee?: Pick<Employee, "careerLevel" | "position"> | null;
};

/**
 * Position name with the career level as a quiet second line. They are kept
 * apart on purpose: "Senior Trưởng nhóm…" reads as one mixed-language title.
 */
export function PositionLabel({ employee }: PositionLabelProps) {
  const { te } = useTranslation();
  const level = formatCareerLevel(employee?.careerLevel, te);

  return (
    <Stack gap={2}>
      <Text size="sm">{employee?.position?.name ?? "-"}</Text>
      {level ? (
        <Text size="xs" c="dimmed">
          {level}
        </Text>
      ) : null}
    </Stack>
  );
}
