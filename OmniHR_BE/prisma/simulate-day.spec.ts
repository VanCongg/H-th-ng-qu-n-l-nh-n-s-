import { clampToToday } from "./simulate-day";

describe("simulator date bounds", () => {
  const today = new Date("2026-09-21T00:00:00.000Z");

  it("refuses to simulate past today", () => {
    const requested = new Date("2029-12-31T00:00:00.000Z");

    expect(clampToToday(requested, today)).toEqual(today);
  });

  it("leaves a past date alone", () => {
    const requested = new Date("2026-06-30T00:00:00.000Z");

    expect(clampToToday(requested, today)).toEqual(requested);
  });

  it("allows today itself", () => {
    expect(clampToToday(today, today)).toEqual(today);
  });
});
