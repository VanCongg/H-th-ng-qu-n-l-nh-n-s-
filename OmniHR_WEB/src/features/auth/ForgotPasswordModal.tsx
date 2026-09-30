import { Alert, Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../api/axios";
import { authApi } from "../../api/endpoints";
import { useTranslation } from "../../i18n";

/** What the server asks of a new password (IsStrongPassword + MinLength). */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const RESEND_AFTER_SECONDS = 60;

type ForgotPasswordModalProps = {
  opened: boolean;
  initialIdentifier: string;
  onClose: () => void;
  /** Called with the sign-in name once the password is reset. */
  onReset: (identifier: string) => void;
};

/**
 * Two steps: the sign-in name, then the code emailed to the account together
 * with the new password. The first step's answer is the same whether or not
 * the account exists, so the form cannot be used to find out who has one.
 */
export function ForgotPasswordModal({ opened, initialIdentifier, onClose, onReset }: ForgotPasswordModalProps) {
  const { tx } = useTranslation();
  return (
    <Modal opened={opened} onClose={onClose} title={tx("Forgot password")} centered>
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {opened ? <ForgotPasswordForm initialIdentifier={initialIdentifier} onReset={onReset} /> : null}
    </Modal>
  );
}

function ForgotPasswordForm({
  initialIdentifier,
  onReset
}: Pick<ForgotPasswordModalProps, "initialIdentifier" | "onReset">) {
  const { tx } = useTranslation();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [step, setStep] = useState<"identify" | "reset">("identify");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const send = useMutation({
    mutationFn: () => authApi.forgotPassword(identifier.trim()),
    onSuccess: () => {
      setStep("reset");
      setResendIn(RESEND_AFTER_SECONDS);
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });
  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(identifier.trim(), code, password),
    onSuccess: () => {
      notifications.show({ color: "green", message: tx("Password reset. Sign in with the new password.") });
      onReset(identifier.trim());
    },
    onError: (error) => notifications.show({ color: "red", message: getApiErrorMessage(error) })
  });

  const passwordError =
    password && !STRONG_PASSWORD.test(password)
      ? tx("At least 8 characters with uppercase, lowercase, a number and a symbol")
      : null;
  const confirmError = confirm && confirm !== password ? tx("Passwords do not match") : null;
  const canReset = code.length === 6 && password && !passwordError && confirm === password;

  return (
    <>
      {step === "identify" ? (
        <Stack>
          <Text size="sm" c="dimmed">
            {tx("Enter your username, email or employee code. A code will be sent to the email of the account.")}
          </Text>
          <TextInput
            label={tx("Username, email or employee code")}
            value={identifier}
            onChange={(event) => setIdentifier(event.currentTarget.value)}
            data-autofocus
          />
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!identifier.trim()}>
            {tx("Send code")}
          </Button>
        </Stack>
      ) : (
        <Stack>
          <Alert color="blue" icon={<MailCheck size={16} />}>
            {tx("If the account exists, a 6-digit code was sent to its email. It is valid for 10 minutes.")}
          </Alert>
          <TextInput
            label={tx("Verification code")}
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            data-autofocus
          />
          <PasswordInput
            label={tx("New password")}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={passwordError}
            autoComplete="new-password"
          />
          <PasswordInput
            label={tx("Confirm new password")}
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
            error={confirmError}
            autoComplete="new-password"
          />
          <Group justify="space-between">
            <Button variant="subtle" disabled={resendIn > 0} loading={send.isPending} onClick={() => send.mutate()}>
              {resendIn > 0 ? `${tx("Resend code")} (${resendIn}s)` : tx("Resend code")}
            </Button>
            <Button onClick={() => reset.mutate()} loading={reset.isPending} disabled={!canReset}>
              {tx("Reset password")}
            </Button>
          </Group>
        </Stack>
      )}
    </>
  );
}
