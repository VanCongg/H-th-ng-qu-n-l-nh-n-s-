import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { getCurrentLanguage, translateText } from "../../i18n";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function openConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm
}: ConfirmOptions) {
  const language = getCurrentLanguage();

  modals.openConfirmModal({
    title: translateText(language, title),
    radius: "md",
    centered: true,
    children: <Text size="sm">{translateText(language, message)}</Text>,
    labels: {
      confirm: confirmLabel
        ? translateText(language, confirmLabel)
        : translateText(language, "Confirm"),
      cancel: translateText(language, "Cancel")
    },
    confirmProps: { color: "red" },
    onConfirm
  });
}
