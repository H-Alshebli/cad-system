import type { BaseEntity } from "@/lib/server/models/entity";
import type { GenericRepository } from "@/lib/server/repositories/interfaces/repository";
import { FirestoreGenericRepository } from "@/lib/server/repositories/firestore/FirestoreGenericRepository";

export type RepositoryFactory = {
  forCollection<T extends BaseEntity>(
    collectionName: string
  ): GenericRepository<T>;
};

class FirestoreRepositoryFactory implements RepositoryFactory {
  forCollection<T extends BaseEntity>(
    collectionName: string
  ): GenericRepository<T> {
    return new FirestoreGenericRepository<T>(collectionName);
  }
}

export function createRepositoryFactory(): RepositoryFactory {
  return new FirestoreRepositoryFactory();
}

export const repositoryFactory = createRepositoryFactory();
