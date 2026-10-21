import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CompanyLocationPicker } from "./CompanyLocationPicker";

// jsdom ships neither of these, and Mantine/Leaflet both read them on mount.
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
});

function renderInForm(onSubmit: () => void) {
  return render(
    <MantineProvider>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <CompanyLocationPicker
          latitude={21.02776}
          longitude={105.83416}
          radiusMeters={150}
          onChange={() => {}}
        />
        <button type="submit">Save settings</button>
      </form>
    </MantineProvider>
  );
}

describe("CompanyLocationPicker inside the settings form", () => {
  it("does not submit the form when locating or clearing", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderInForm(onSubmit);

    const locate = screen.getByRole("button", { name: /use my location/i });
     
    console.log("locate type attr =", JSON.stringify(locate.getAttribute("type")));
    await user.click(locate);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /clear location/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
