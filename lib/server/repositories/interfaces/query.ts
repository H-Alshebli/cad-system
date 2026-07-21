import type { EntityId } from "@/lib/server/models/entity";

export type RepositoryFilterOperator =
  | "<"
  | "<="
  | "=="
  | "!="
  | ">="
  | ">"
  | "array-contains"
  | "in"
  | "not-in"
  | "array-contains-any";

export type RepositoryFilter = {
  field: string;
  operator: RepositoryFilterOperator;
  value: unknown;
};

export type RepositorySort = {
  field: string;
  direction?: "asc" | "desc";
};

export type RepositoryListOptions = {
  filters?: RepositoryFilter[];
  sort?: RepositorySort[];
  limit?: number;
};

export type RepositoryListResult<T> = {
  items: T[];
  count: number;
};

export type RepositoryLookup = {
  id: EntityId;
};
