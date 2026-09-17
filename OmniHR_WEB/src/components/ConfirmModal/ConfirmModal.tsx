import { modals } from "@mantine/modals";
import { Stack, Text } from "@mantine/core";
import { getCurrentLanguage, translateText } from "../../i18n";

type ConfirmOptions = {
  title: string;
  message: string;
  /** Consequences of confirming, shown under the question. */
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function openConfirmModal({
  title,
  message,
  description,
  confirmLabel,
  onConfirm
}: ConfirmOptions) {
  const language = getCurrentLanguage();

  modals.openConfirmModal({
    title: (
      <Text fw={700} size="lg">
        {translateText(language, title)}
      </Text>
    ),
    radius: "md",
    centered: true,
    children: (
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          {translateText(language, message)}
        </Text>
        {description ? (
          <Text size="sm" c="dimmed">
            {translateText(language, description)}
          </Text>
        ) : null}
      </Stack>
    ),
    labels: {
      confirm: confirmLabel
        ? translateText(language, confirmLabel)
        : translateText(language, "Confirm"),
      cancel: translateText(language, "Cancel")
    },
    // A fixed dark shade: the dark theme's primaryShade (3) would otherwise
    // render a pale red button with unreadable white text.
    confirmProps: { color: "red.8" },
    onConfirm
  });
}
