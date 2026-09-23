import { clampToToday, officeFrom } from "./simulate-day";

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

describe("simulated punch location", () => {
  const FALLBACK = { latitude: 21.0227, longitude: 105.8466 };

  it("follows the configured company location", () => {
    expect(
      officeFrom({ companyLatitude: 21.212445, companyLongitude: 106.137263 })
    ).toEqual({ latitude: 21.212445, longitude: 106.137263 });
  });

  it("falls back while the seed leaves the company point unset", () => {
    expect(officeFrom({ companyLatitude: null, companyLongitude: null })).toEqual(
      FALLBACK
    );
    expect(officeFrom({})).toEqual(FALLBACK);
    expect(officeFrom(undefined)).toEqual(FALLBACK);
  });

  it("falls back rather than generating punches at a broken coordinate", () => {
    expect(officeFrom({ companyLatitude: 21.2, companyLongitude: "106.1" })).toEqual(
      FALLBACK
    );
    expect(officeFrom({ companyLatitude: Number.NaN, companyLongitude: 106.1 })).toEqual(
      FALLBACK
    );
  });
});
