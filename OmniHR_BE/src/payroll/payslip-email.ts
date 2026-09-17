type PayslipEmailInput = {
  standardWorkDays: number;
  attendanceDays: number;
  paidLeaveDays: number;
  payableDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  baseSalary: number;
  allowance: number;
  grossSalary: number;
  overtimePay: number;
  attendanceDeduction: number;
  insuranceDeduction: number;
  netSalary: number;
  employee: {
    employeeCode: string;
    fullName: string;
    department?: { name: string } | null;
    position?: { name: string } | null;
  };
};

const money = new Intl.NumberFormat("vi-VN");

function formatMoney(value: number) {
  return `${money.format(value)} ₫`;
}

function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds the payslip email one employee receives for a finalized period. */
export function buildPayslipEmail(
  period: { year: number; month: number },
  payslip: PayslipEmailInput
) {
  const monthLabel = `${String(period.month).padStart(2, "0")}/${period.year}`;
  const { employee } = payslip;
  const subject = `Phiếu lương tháng ${monthLabel} - ${employee.fullName}`;

  const sections: Array<[string, Array<[string, string]>]> = [
    [
      "Thông tin nhân viên",
      [
        ["Mã nhân viên", employee.employeeCode],
        ["Họ tên", employee.fullName],
        ["Phòng ban", employee.department?.name ?? "-"],
        ["Chức danh", employee.position?.name ?? "-"]
      ]
    ],
    [
      "Chấm công",
      [
        ["Ngày công chuẩn", formatDays(payslip.standardWorkDays)],
        ["Ngày công thực tế", formatDays(payslip.attendanceDays)],
        ["Nghỉ phép có lương", formatDays(payslip.paidLeaveDays)],
        ["Ngày công tính lương", formatDays(payslip.payableDays)],
        ["Đi muộn / về sớm", `${payslip.lateMinutes + payslip.earlyLeaveMinutes} phút`],
        ["Tăng ca", `${payslip.overtimeMinutes} phút`]
      ]
    ],
    [
      "Thu nhập và khấu trừ",
      [
        ["Lương cơ bản", formatMoney(payslip.baseSalary)],
        ["Lương theo ngày công", formatMoney(payslip.grossSalary)],
        ["Phụ cấp", formatMoney(payslip.allowance)],
        ["Tiền tăng ca", formatMoney(payslip.overtimePay)],
        ["Trừ đi muộn / về sớm", `-${formatMoney(payslip.attendanceDeduction)}`],
        ["Bảo hiểm bắt buộc", `-${formatMoney(payslip.insuranceDeduction)}`]
      ]
    ]
  ];

  const rows = sections
    .map(
      ([title, items]) =>
        `<tr><td colspan="2" style="padding:12px 8px 4px;font-weight:700;color:#1c7ed6">${escapeHtml(title)}</td></tr>` +
        items
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 8px;color:#555">${escapeHtml(label)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(value)}</td></tr>`
          )
          .join("")
    )
    .join("");

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">
<h2 style="margin:0 0 4px">Phiếu lương tháng ${monthLabel}</h2>
<p style="margin:0 0 12px;color:#555">Xin chào ${escapeHtml(employee.fullName)}, dưới đây là phiếu lương của bạn.</p>
<table style="border-collapse:collapse;width:100%;max-width:520px">${rows}
<tr><td style="padding:12px 8px;font-weight:700;border-top:2px solid #222">Thực nhận</td><td style="padding:12px 8px;text-align:right;font-weight:700;border-top:2px solid #222">${escapeHtml(formatMoney(payslip.netSalary))}</td></tr>
</table>
<p style="margin-top:16px;color:#888;font-size:12px">Email được gửi tự động từ OmniHR. Vui lòng liên hệ bộ phận kế toán nếu có sai sót.</p>
</body></html>`;

  const text = [
    `Phiếu lương tháng ${monthLabel}`,
    ...sections.flatMap(([title, items]) => [
      "",
      title,
      ...items.map(([label, value]) => `${label}: ${value}`)
    ]),
    "",
    `Thực nhận: ${formatMoney(payslip.netSalary)}`
  ].join("\n");

  return { subject, html, text };
}
