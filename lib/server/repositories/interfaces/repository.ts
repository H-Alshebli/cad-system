import type {
  BaseEntity,
  CreateEntityInput,
  EntityId,
  RepositoryWriteOptions,
  UpdateEntityInput,
} from "@/lib/server/models/entity";
import type {
  RepositoryListOptions,
  RepositoryListResult,
} from "@/lib/server/repositories/interfaces/query";

export type GenericRepository<T extends BaseEntity> = {
  collectionName: string;

  getById(id: EntityId): Promise<T | null>;

  exists(id: EntityId): Promise<boolean>;

  list(options?: RepositoryListOptions): Promise<RepositoryListResult<T>>;

  create(
    data: CreateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T>;

  set(
    id: EntityId,
    data: CreateEntityInput<T> | UpdateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T>;

  update(
    id: EntityId,
    data: UpdateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T>;

  delete(id: EntityId): Promise<void>;
};
