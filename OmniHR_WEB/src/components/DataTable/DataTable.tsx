import {
  Alert,
  Box,
  Group,
  Loader,
  Pagination,
  ScrollArea,
  Table,
  Text
} from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { EmptyState } from "../EmptyState";

export type DataColumn<T> = {
  key: string;
  label: string;
  width?: number | string;
  render: (item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataColumn<T>[];
  data?: T[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  page?: number;
  total?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
};

export function DataTable<T>({
  columns,
  data = [],
  loading,
  error,
  emptyTitle,
  page = 1,
  total,
  limit = 20,
  onPageChange
}: DataTableProps<T>) {
  const { tx } = useTranslation();

  if (error) {
    return (
      <Alert color="red" icon={<AlertTriangle size={16} />} radius="md">
        {error}
      </Alert>
    );
  }

  return (
    <Box className="table-shell">
      <ScrollArea>
        <Table striped highlightOnHover verticalSpacing="sm" miw={720}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.key} style={{ width: column.width }}>
                  {tx(column.label)}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Group justify="center" py="xl">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                      {tx("Loading")}
                    </Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ) : data.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} />
                </Table.Td>
              </Table.Tr>
            ) : (
              data.map((item, index) => (
                <Table.Tr key={index}>
                  {columns.map((column) => (
                    <Table.Td key={column.key}>{column.render(item)}</Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {total !== undefined && total > limit ? (
        <Group justify="flex-end" p="sm">
          <Pagination
            total={Math.ceil(total / limit)}
            value={page}
            onChange={onPageChange}
            size="sm"
          />
        </Group>
      ) : null}
    </Box>
  );
}
