import { Select, type SelectProps } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { employeesApi } from "../../api/endpoints";
import type { Employee } from "../../api/types";
import { useTranslation } from "../../i18n";

type EmployeeSelectProps = Omit<
  SelectProps,
  "data" | "value" | "onChange" | "searchable" | "searchValue" | "onSearchChange" | "filter"
> & {
  scope: "all" | "team";
  value: string | null;
  onChange: (value: string | null) => void;
};

function toOption(employee: Pick<Employee, "id" | "employeeCode" | "fullName">) {
  return { value: String(employee.id), label: `${employee.employeeCode} - ${employee.fullName}` };
}

/**
 * Employee picker that searches on the server (name, code or email), so it
 * stays usable when the company has more employees than one page holds.
 */
export function EmployeeSelect({ scope, value, onChange, ...props }: EmployeeSelectProps) {
  const { tx } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  // Remember the chosen option so its label survives a search that no longer returns it.
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);

  // Typing into the input also echoes the selected label; don't search for that.
  const term = selected && debouncedSearch === selected.label ? "" : debouncedSearch.trim();
  const listQuery = useQuery({
    queryKey: ["employee-select", scope, term],
    queryFn: () => {
      const params = { search: term || undefined, limit: 20 };
      return scope === "team" ? employeesApi.team(params) : employeesApi.list(params);
    },
    placeholderData: keepPreviousData
  });
  // A value set from outside (e.g. a URL param) arrives without its label.
  const needsLookup = Boolean(value) && selected?.value !== value;
  const valueQuery = useQuery({
    queryKey: ["employee-select-value", value],
    queryFn: () => employeesApi.get(Number(value)),
    enabled: needsLookup
  });

  const options = (listQuery.data?.items ?? []).map(toOption);
  const current =
    selected?.value === value ? selected : valueQuery.data ? toOption(valueQuery.data) : null;
  if (current && !options.some((option) => option.value === current.value)) {
    options.unshift(current);
  }

  return (
    <Select
      {...props}
      data={options}
      value={value}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      // The server already filtered; don't filter again on the client.
      filter={({ options: items }) => items}
      nothingFoundMessage={listQuery.isFetching ? tx("Loading") : tx("No employees found")}
      onChange={(next, option) => {
        setSelected(next ? option : null);
        onChange(next);
      }}
    />
  );
}
