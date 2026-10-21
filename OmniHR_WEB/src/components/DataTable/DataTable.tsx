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
import { useMemo, useState, type ReactNode } from "react";
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
  className?: string;
  tableMinWidth?: number | string;
  rowKey?: (item: T, index: number) => string | number;
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
  className,
  tableMinWidth = 720,
  rowKey,
  page = 1,
  total,
  limit = 20,
  onPageChange
}: DataTableProps<T>) {
  const { tx } = useTranslation();
  const [internalPage, setInternalPage] = useState(1);
  const isServerPaginated = total !== undefined && Boolean(onPageChange);
  const isClientPaginated = total === undefined && data.length > limit;
  const clientPageCount = Math.max(1, Math.ceil(data.length / limit));
  const effectiveInternalPage = isClientPaginated ? Math.min(internalPage, clientPageCount) : 1;
  const activePage = isServerPaginated ? page : effectiveInternalPage;
  const activeTotal = isServerPaginated && total !== undefined ? total : data.length;
  const tableData = useMemo(() => {
    if (!isClientPaginated) {
      return data;
    }

    const start = (effectiveInternalPage - 1) * limit;
    return data.slice(start, start + limit);
  }, [data, effectiveInternalPage, isClientPaginated, limit]);

  if (error) {
    return (
      <Alert color="red" icon={<AlertTriangle size={16} />} radius="md">
        {error}
      </Alert>
    );
  }

  return (
    <Box className={["table-shell", className].filter(Boolean).join(" ")}>
      <ScrollArea type="auto">
        <Table striped highlightOnHover verticalSpacing="sm" miw={tableMinWidth}>
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
                <Table.Tr key={rowKey ? rowKey(item, index) : index}>
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
