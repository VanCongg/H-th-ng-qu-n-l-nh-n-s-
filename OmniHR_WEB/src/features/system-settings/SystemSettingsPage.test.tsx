import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.fn();
const updateSettings = vi.fn();

vi.mock("../../api/endpoints", () => ({
  dashboardApi: {
    settings: () => settings(),
    updateSettings: (values: Record<string, unknown>) => updateSettings(values)
  }
}));

import { SystemSettingsPage } from "./SystemSettingsPage";

const SERVER_SETTINGS = {
  companyName: "Công ty Cổ phần OmniHR",
  companyAddress: "Tầng 12, 72 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
  companyLatitude: null,
  companyLongitude: null,
  attendanceRadiusMeters: 150,
  requireAttendanceLocation: true,
  workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
};

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (onSuccess: (position: unknown) => void) =>
        onSuccess({ coords: { latitude: 21.024518, longitude: 105.85218 } })
    }
  });
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } }
  });
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <SystemSettingsPage />
      </MantineProvider>
    </QueryClientProvider>
  );
  return client;
}

describe("SystemSettingsPage", () => {
  beforeEach(() => {
    settings.mockReset();
    updateSettings.mockReset();
    // A fresh object per call, exactly like axios returns.
    settings.mockImplementation(async () => ({ ...SERVER_SETTINGS }));
    updateSettings.mockResolvedValue({ ...SERVER_SETTINGS });
  });

  it("keeps a picked company location when the query refetches", async () => {
    const user = userEvent.setup();
    const client = renderPage();

    await screen.findByText(/no location selected/i);

    await user.click(screen.getByRole("button", { name: /use my location/i }));
    await screen.findByText("21.024518, 105.852180");

    // Any background refetch does this: window focus (on by default), a
    // reconnect, or another screen invalidating the same key.
    await act(async () => {
      await client.refetchQueries({ queryKey: ["system-settings"] });
    });
    await waitFor(() => expect(settings).toHaveBeenCalledTimes(2));

    // The pin the user just placed must survive a refetch that changed nothing.
    expect(screen.getByText("21.024518, 105.852180")).toBeInTheDocument();
  });

  it("warns that the radius is inert while no company location is set", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/attendance radius is not being enforced/i);

    // Placing the pin resolves the misconfiguration, so the warning goes away.
    await user.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() =>
      expect(
        screen.queryByText(/attendance radius is not being enforced/i)
      ).not.toBeInTheDocument()
    );
  });

  it("does not warn when the location requirement is off", async () => {
    settings.mockImplementation(async () => ({
      ...SERVER_SETTINGS,
      requireAttendanceLocation: false
    }));
    renderPage();

    // Wait for the server values to reach the form, not just for first paint:
    // the page's own defaults have the requirement switched on.
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: /require attendance location/i })
      ).not.toBeChecked()
    );
    expect(
      screen.queryByText(/attendance radius is not being enforced/i)
    ).not.toBeInTheDocument();
  });

  it("saves the picked coordinates", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/no location selected/i);
    await user.click(screen.getByRole("button", { name: /use my location/i }));
    await screen.findByText("21.024518, 105.852180");

    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings.mock.calls[0][0]).toMatchObject({
      companyLatitude: 21.024518,
      companyLongitude: 105.85218
    });
  });
});
