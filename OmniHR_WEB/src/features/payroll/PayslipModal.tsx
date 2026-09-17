import { Divider, Group, Modal, Stack, Text } from "@mantine/core";
import { formatDays, formatMinutes, formatMoney, formatMonthYear } from "../../api/format";
import type { Payslip } from "../../api/types";
import { useTranslation } from "../../i18n";

type PayslipModalProps = {
  payslip: Payslip | null;
  period?: { month: number; year: number };
  onClose: () => void;
};

export function PayslipModal({ payslip, period, onClose }: PayslipModalProps) {
  const { tx } = useTranslation();
  const sections: Array<[string, Array<[string, string]>]> = payslip
    ? [
        [
          tx("Attendance"),
          [
            [tx("Standard work days"), formatDays(payslip.standardWorkDays)],
            [tx("Actual work days"), formatDays(payslip.attendanceDays)],
            [tx("Paid leave"), formatDays(payslip.paidLeaveDays)],
            [tx("Payable days"), formatDays(payslip.payableDays)],
            [
              tx("Late / early leave"),
              formatMinutes(payslip.lateMinutes + payslip.earlyLeaveMinutes)
            ],
            [tx("Overtime"), formatMinutes(payslip.overtimeMinutes)]
          ]
        ],
        [
          tx("Payroll"),
          [
            [tx("Base salary"), formatMoney(payslip.baseSalary)],
            [tx("Salary by work days"), formatMoney(payslip.grossSalary)],
            [tx("Allowance"), formatMoney(payslip.allowance)],
            [tx("Overtime pay"), formatMoney(payslip.overtimePay)],
            [tx("Late/early deduction"), `-${formatMoney(payslip.attendanceDeduction)}`],
            [tx("Insurance"), `-${formatMoney(payslip.insuranceDeduction)}`]
          ]
        ]
      ]
    : [];

  return (
    <Modal
      opened={Boolean(payslip)}
      onClose={onClose}
      title={
        payslip && period
          ? `${tx("Payslip")} ${formatMonthYear(period)} · ${payslip.employee.fullName}`
          : tx("Payslip")
      }
    >
      {payslip ? (
        <Stack gap="sm">
          {sections.map(([title, rows]) => (
            <Stack key={title} gap={4}>
              <Text fw={700} c="blue">
                {title}
              </Text>
              {rows.map(([label, value]) => (
                <Group key={label} justify="space-between">
                  <Text size="sm" c="dimmed">
                    {label}
                  </Text>
                  <Text size="sm">{value}</Text>
                </Group>
              ))}
            </Stack>
          ))}
          <Divider />
          <Group justify="space-between">
            <Text fw={800}>{tx("Net pay")}</Text>
            <Text fw={800}>{formatMoney(payslip.netSalary)}</Text>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
