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
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [internalPage, setInternalPage] = useState(1);
  const isServerPaginated = total !== undefined && Boolean(onPageChange);
  const isClientPaginated = total === undefined && data.length > limit;
  const activePage = isServerPaginated ? page : internalPage;
  const activeTotal = isServerPaginated && total !== undefined ? total : data.length;
  const tableData = useMemo(() => {
    if (!isClientPaginated) {
      return data;
    }

    const start = (internalPage - 1) * limit;
    return data.slice(start, start + limit);
  }, [data, internalPage, isClientPaginated, limit]);

  useEffect(() => {
    if (!isClientPaginated) {
      setInternalPage(1);
      return;
    }

    const pageCount = Math.max(1, Math.ceil(data.length / limit));
    if (internalPage > pageCount) {
      setInternalPage(pageCount);
    }
  }, [data.length, internalPage, isClientPaginated, limit]);

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
            ) : tableData.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} />
                </Table.Td>
              </Table.Tr>
            ) : (
              tableData.map((item, index) => (
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
      {(isServerPaginated || isClientPaginated) && activeTotal > limit ? (
        <Group justify="flex-end" p="sm">
          <Pagination
            total={Math.ceil(activeTotal / limit)}
            value={activePage}
            onChange={isServerPaginated && onPageChange ? onPageChange : setInternalPage}
            size="sm"
          />
        </Group>
      ) : null}
    </Box>
  );
}
