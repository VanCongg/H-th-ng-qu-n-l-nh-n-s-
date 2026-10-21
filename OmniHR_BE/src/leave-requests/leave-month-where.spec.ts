import { leaveMonthWhere } from "./leave-requests.service";

describe("leaveMonthWhere", () => {
  it("matches any request whose leave days overlap the month", () => {
    expect(leaveMonthWhere(2026, 9)).toEqual({
      startDate: { lte: new Date("2026-09-30T00:00:00.000Z") },
      endDate: { gte: new Date("2026-09-01T00:00:00.000Z") }
    });
  });

  it("handles February and December boundaries", () => {
    expect(leaveMonthWhere(2028, 2).startDate).toEqual({ lte: new Date("2028-02-29T00:00:00.000Z") });
    expect(leaveMonthWhere(2026, 12)).toEqual({
      startDate: { lte: new Date("2026-12-31T00:00:00.000Z") },
      endDate: { gte: new Date("2026-12-01T00:00:00.000Z") }
    });
  });
});
