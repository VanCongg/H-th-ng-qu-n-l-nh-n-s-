import { Avatar } from "@mantine/core";
type EmployeeAvatarProps = {
  employee?: {
    fullName?: string | null;
    avatarUrl?: string | null;
  } | null;
  size?: number | string;
};

export function EmployeeAvatar({ employee, size = 36 }: EmployeeAvatarProps) {
  return (
    <Avatar
      src={employee?.avatarUrl || undefined}
      alt={employee?.fullName || "Employee"}
      radius="md"
      size={size}
      color="blue"
    >
      {initials(employee?.fullName)}
    </Avatar>
  );
}

function initials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) {
    return "NV";
  }
  return parts
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
