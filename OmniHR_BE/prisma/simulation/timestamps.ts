import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Prisma fills `@default(now())` and `@updatedAt` columns in its query engine,
 * from the machine's real clock, so the simulated clock never reaches them: a
 * leave approved on a replayed 12 May would still say it was created today.
 * This extension writes those columns itself, from `new Date()` - which the
 * simulated clock answers - whenever the caller left them out.
 *
 * Only the simulator uses it. The API writes with the real clock as always.
 */

type FieldInfo = { stamps: string[]; updatedAt: string[]; relations: Map<string, string> };

const models = new Map<string, FieldInfo>(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    {
      // Set on create: @default(now()) and @updatedAt alike.
      stamps: model.fields
        .filter(
          (field) =>
            field.kind === "scalar" &&
            field.type === "DateTime" &&
            (field.isUpdatedAt ||
              (typeof field.default === "object" &&
                field.default !== null &&
                "name" in field.default &&
                field.default.name === "now"))
        )
        .map((field) => field.name),
      updatedAt: model.fields.filter((field) => field.isUpdatedAt).map((field) => field.name),
      relations: new Map(
        model.fields.filter((field) => field.kind === "object").map((field) => [field.name, field.type])
      )
    }
  ])
);

type Data = Record<string, unknown>;

function asList(value: unknown): Data[] {
  if (Array.isArray(value)) {
    return value as Data[];
  }
  return value && typeof value === "object" ? [value as Data] : [];
}

/** Stamps a row about to be created, and whatever it creates along with it. */
export function stampCreate(model: string, data: unknown, now: Date) {
  const info = models.get(model);
  for (const row of asList(data)) {
    if (!info) {
      continue;
    }
    for (const field of info.stamps) {
      if (row[field] === undefined) {
        row[field] = now;
      }
    }
    stampNested(info, row, now);
  }
}

/** Stamps a row about to be updated: its @updatedAt, and rows it creates on the way. */
export function stampUpdate(model: string, data: unknown, now: Date) {
  const info = models.get(model);
  for (const row of asList(data)) {
    if (!info) {
      continue;
    }
    for (const field of info.updatedAt) {
      if (row[field] === undefined) {
        row[field] = now;
      }
    }
    stampNested(info, row, now);
  }
}

function stampNested(info: FieldInfo, row: Data, now: Date) {
  for (const [field, related] of info.relations) {
    const nested = row[field];
    if (!nested || typeof nested !== "object") {
      continue;
    }
    const operations = nested as Data;
    stampCreate(related, operations.create, now);
    for (const item of asList(operations.createMany)) {
      stampCreate(related, item.data, now);
    }
    for (const item of asList(operations.connectOrCreate)) {
      stampCreate(related, item.create, now);
    }
    for (const item of asList(operations.upsert)) {
      stampCreate(related, item.create, now);
      stampUpdate(related, item.update, now);
    }
    for (const item of asList(operations.update)) {
      // A to-one update takes the data directly, a to-many one wraps it.
      stampUpdate(related, "data" in item && "where" in item ? item.data : item, now);
    }
    for (const item of asList(operations.updateMany)) {
      stampUpdate(related, item.data, now);
    }
  }
}

/** A client whose writes carry the simulated time. */
export function withSimulatedTimestamps(client: PrismaClient) {
  return client.$extends({
    name: "simulated-timestamps",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          stampCreate(model, args.data, new Date());
          return query(args);
        },
        async createMany({ model, args, query }) {
          stampCreate(model, args.data, new Date());
          return query(args);
        },
        async update({ model, args, query }) {
          stampUpdate(model, args.data, new Date());
          return query(args);
        },
        async updateMany({ model, args, query }) {
          stampUpdate(model, args.data, new Date());
          return query(args);
        },
        async upsert({ model, args, query }) {
          const now = new Date();
          stampCreate(model, args.create, now);
          stampUpdate(model, args.update, now);
          return query(args);
        }
      }
    }
  });
}
