export type EntityId = string;

export type EntityRecord = Record<string, unknown>;

export type BaseEntity = EntityRecord & {
  id: EntityId;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateEntityInput<T extends BaseEntity> = Omit<T, "id"> &
  EntityRecord;

export type UpdateEntityInput<T extends BaseEntity> = Partial<
  Omit<T, "id">
> &
  EntityRecord;

export type RepositoryWriteOptions = {
  merge?: boolean;
  addTimestamps?: boolean;
};
