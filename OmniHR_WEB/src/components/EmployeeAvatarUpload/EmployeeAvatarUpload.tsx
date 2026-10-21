import { ActionIcon, FileInput, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { ImageUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "../../i18n";
import { EmployeeAvatar } from "../EmployeeAvatar";

const MAX_AVATAR_BYTES = 700 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

type EmployeeAvatarUploadProps = {
  value?: string | null;
  fullName?: string | null;
  onChange: (value: string | null) => void;
};

export function EmployeeAvatarUpload({
  value,
  fullName,
  onChange
}: EmployeeAvatarUploadProps) {
  const { tx } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | null) {
    setError(null);
    if (!file) {
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError(tx("PNG, JPG, WebP, or GIF image is required"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(tx("Image must be 700 KB or smaller"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.onerror = () => setError(tx("Cannot read image file"));
    reader.readAsDataURL(file);
  }

  return (
    <Paper withBorder radius="md" p="md" className="employee-avatar-upload">
      <Stack gap="sm" align="center">
        <EmployeeAvatar
          employee={{ fullName: fullName || undefined, avatarUrl: value || undefined }}
          size={132}
        />
        <FileInput
          accept="image/png,image/jpeg,image/webp,image/gif"
          leftSection={<ImageUp size={16} />}
          placeholder={tx("Upload image")}
          onChange={handleFile}
          className="employee-avatar-file"
        />
        {value ? (
          <Tooltip label={tx("Remove avatar")}>
            <ActionIcon variant="subtle" color="red" onClick={() => onChange(null)}>
              <X size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null}
        {error ? (
          <Text size="xs" c="red" ta="center">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
