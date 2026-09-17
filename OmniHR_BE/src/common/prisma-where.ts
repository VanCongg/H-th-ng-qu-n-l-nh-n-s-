import { Prisma } from "@prisma/client";

function andWhere<T>(...filters: Array<T | undefined>): T {
  const activeFilters = filters.filter(Boolean) as T[];
  if (activeFilters.length === 1) {
    return activeFilters[0];
  }

  return { AND: activeFilters } as T;
}

export function currentUserWhere(
  ...filters: Array<Prisma.UserWhereInput | undefined>
): Prisma.UserWhereInput {
  return andWhere<Prisma.UserWhereInput>({ deletedAt: null }, ...filters);
}

export function currentEmployeeWhere(
  ...filters: Array<Prisma.EmployeeWhereInput | undefined>
): Prisma.EmployeeWhereInput {
  return andWhere<Prisma.EmployeeWhereInput>(
    { deletedAt: null },
    {
      OR: [
        { userId: null },
        {
          user: {
            is: currentUserWhere()
          }
        }
      ]
    },
    ...filters
  );
}

/** Current employees matching a name/code search and an optional department. */
export function employeeSearchWhere(
  search?: string,
  departmentId?: number
): Prisma.EmployeeWhereInput {
  const term = search?.trim();
  return currentEmployeeWhere(
    departmentId ? { departmentId } : undefined,
    term
      ? {
          OR: [
            { fullName: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { employeeCode: { contains: term, mode: Prisma.QueryMode.insensitive } }
          ]
        }
      : undefined
  );
}
