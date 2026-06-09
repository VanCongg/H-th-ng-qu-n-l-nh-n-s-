import {
  calculateLeaveDays,
  formatDateDdMmYyyy,
  omitSensitiveUser,
  pagination,
  toDateOnly
} from "./utils";

describe("common utils", () => {
  it("normalizes date-only values to UTC midnight", () => {
    expect(toDateOnly("2026-06-09").toISOString()).toBe(
      "2026-06-09T00:00:00.000Z"
    );
  });

  it("formats ddMMyyyy from UTC dates", () => {
    expect(formatDateDdMmYyyy(new Date("1990-01-05T10:30:00.000Z"))).toBe(
      "05011990"
    );
  });

  it("counts leave days excluding weekends", () => {
    const start = toDateOnly("2026-06-05");
    const end = toDateOnly("2026-06-09");

    expect(calculateLeaveDays(start, end)).toBe(3);
  });

  it("bounds pagination input", () => {
    expect(pagination(-5, 500)).toEqual({
      skip: 0,
      take: 100,
      page: 1,
      limit: 100
    });
  });

  it("omits sensitive user token and password fields", () => {
    expect(
      omitSensitiveUser({
        id: 1,
        username: "admin",
        passwordHash: "secret",
        refreshTokenHash: "refresh"
      })
    ).toEqual({
      id: 1,
      username: "admin"
    });
  });
});
