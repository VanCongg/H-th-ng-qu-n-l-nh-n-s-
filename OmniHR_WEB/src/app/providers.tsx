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
