import { describe, expect, it } from "vitest";
import {
  formatCareerLevel,
  formatDepartmentName,
  formatEmployeeJobTitle,
  formatTeamName,
  formatDays,
  formatMinutes,
  formatMoney,
  formatMonthYear,
  monthOptions,
  statusColor,
  yearOptions
} from "./format";

describe("formatCareerLevel", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatCareerLevel(null)).toBe("");
    expect(formatCareerLevel(undefined)).toBe("");
  });

  it("returns the label for a known level", () => {
    expect(formatCareerLevel("SENIOR")).toBe("Senior");
  });

  it("prefers a translated value when the translator changes it", () => {
    expect(formatCareerLevel("SENIOR", () => "Cấp cao")).toBe("Cấp cao");
  });

  it("falls back to the label when the translator returns the same value", () => {
    expect(formatCareerLevel("SENIOR", (value) => value ?? "")).toBe("Senior");
  });
});

describe("formatEmployeeJobTitle", () => {
  it("returns '-' when employee is missing", () => {
    expect(formatEmployeeJobTitle(null)).toBe("-");
  });

  it("joins career level and position name", () => {
    expect(
      formatEmployeeJobTitle({
        careerLevel: "SENIOR",
        position: { name: "Backend Engineer" } as never
      })
    ).toBe("Senior Backend Engineer");
  });

  it("returns '-' when neither career level nor position is set", () => {
    expect(
      formatEmployeeJobTitle({ careerLevel: null, position: null } as never)
    ).toBe("-");
  });
});

describe("formatDepartmentName", () => {
  it("returns '-' when department is missing", () => {
    expect(formatDepartmentName(null)).toBe("-");
  });

  it("maps known department codes to canonical names", () => {
    expect(formatDepartmentName({ code: "ENG", name: "Kỹ thuật" })).toBe("Engineering");
  });

  it("falls back to the raw name for unknown codes", () => {
    expect(formatDepartmentName({ code: "XYZ", name: "Custom Dept" })).toBe("Custom Dept");
  });
});

describe("formatTeamName", () => {
  it("returns '-' when team is missing", () => {
    expect(formatTeamName(null)).toBe("-");
  });

  it("formats as 'code - name'", () => {
    expect(formatTeamName({ code: "T1", name: "Team Alpha" })).toBe("T1 - Team Alpha");
  });
});

describe("statusColor", () => {
  it("maps known statuses to their color", () => {
    expect(statusColor("APPROVED")).toBe("green");
    expect(statusColor("PENDING")).toBe("yellow");
    expect(statusColor("REJECTED")).toBe("red");
    expect(statusColor("CANCELLED")).toBe("gray");
    expect(statusColor("IN_PROGRESS")).toBe("orange");
  });

  it("defaults to blue for unknown statuses", () => {
    expect(statusColor("SOMETHING_ELSE")).toBe("blue");
    expect(statusColor(undefined)).toBe("blue");
  });
});

describe("payroll formatting", () => {
  it("formats money as whole VND and keeps missing values as a dash", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(22_000_000).replace(/\D/g, "")).toBe("22000000");
  });

  it("formats minutes as hours and minutes", () => {
    expect(formatMinutes(0)).toBe("0");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(65)).toBe("1h05");
  });

  it("keeps whole days whole and shows half days with one decimal", () => {
    expect(formatDays(22)).toBe("22");
    expect(formatDays(20.5)).toBe("20.5");
  });

  it("builds month and year labels and options", () => {
    expect(formatMonthYear({ month: 9, year: 2026 })).toBe("09/2026");
    expect(monthOptions("Tháng")[0]).toEqual({ value: "1", label: "Tháng 1" });
    expect(yearOptions(2026).map((option) => option.value)).toEqual([
      "2024",
      "2025",
      "2026",
      "2027"
    ]);
  });
});
