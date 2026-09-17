import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "../styles/global.css";

import {
  createTheme,
  MantineProvider,
  rem,
  type MantineThemeOverride
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1
    }
  }
});

const theme: MantineThemeOverride = createTheme({
  primaryColor: "blue",
  // Dark shade 8: filled buttons keep readable white labels (shade 3 did not),
  // and subtle/light variants derive a clearly coloured tint from it.
  primaryShade: { light: 6, dark: 8 },
  // Mantine's neutral dark greys clashed with the navy shell, so dark surfaces
  // (cards, tables, inputs, menus) use the same navy scale.
  colors: {
    dark: [
      "#e4e9f2",
      "#c3cddd",
      "#98a6bd",
      "#6b7a93",
      "#3a4a66",
      "#2a3854",
      "#1d2a42",
      "#172033",
      "#111a2b",
      "#0b1120"
    ]
  },
  defaultRadius: "md",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontWeight: "760",
    sizes: {
      h1: { fontSize: rem(34), lineHeight: "1.12" },
      h2: { fontSize: rem(24), lineHeight: "1.18" },
      h3: { fontSize: rem(19), lineHeight: "1.24" }
    }
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md"
      }
    },
    Card: {
      defaultProps: {
        radius: "md",
        withBorder: true
      }
    },
    Modal: {
      defaultProps: {
        radius: "md",
        centered: true
      }
    },
    TextInput: {
      defaultProps: {
        radius: "md"
      }
    },
    Select: {
      defaultProps: {
        radius: "md"
      }
    },
    Paper: {
      defaultProps: {
        radius: "md"
      }
    },
    Badge: {
      // Uppercase Vietnamese labels ("TÀI KHOẢN HOẠT ĐỘNG") were long and got cut off.
      styles: {
        root: { textTransform: "none", fontWeight: 650 }
      }
    }
  }
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ModalsProvider>
          <Notifications position="top-right" />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
