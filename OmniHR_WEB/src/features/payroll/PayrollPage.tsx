import { Stack, Tabs } from "@mantine/core";
import { CalendarDays, Wallet } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useTranslation } from "../../i18n";
import { CompensationsPanel } from "./CompensationsPanel";
import { PayrollPeriodsPanel } from "./PayrollPeriodsPanel";

export function PayrollPage() {
  const { tx } = useTranslation();
  const [tab, setTab] = useState<string | null>("periods");

  return (
    <Stack gap="md">
      <PageHeader
        title="Payroll"
        description="Calculate monthly salaries from attendance, finalize them, and email payslips."
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="periods" leftSection={<CalendarDays size={16} />}>
            {tx("Payroll periods")}
          </Tabs.Tab>
          <Tabs.Tab value="compensations" leftSection={<Wallet size={16} />}>
            {tx("Employee salaries")}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="periods" pt="md">
          <PayrollPeriodsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="compensations" pt="md">
          <CompensationsPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
