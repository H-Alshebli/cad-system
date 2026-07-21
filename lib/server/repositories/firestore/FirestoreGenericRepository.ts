import {
  type DocumentData,
  type Query,
  type WhereFilterOp,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/server/firebaseAdmin";
import type {
  BaseEntity,
  CreateEntityInput,
  EntityId,
  RepositoryWriteOptions,
  UpdateEntityInput,
} from "@/lib/server/models/entity";
import type { GenericRepository } from "@/lib/server/repositories/interfaces/repository";
import type { RepositoryListOptions } from "@/lib/server/repositories/interfaces/query";
import {
  cleanUndefinedDeep,
  withCreateTimestamps,
  withUpdateTimestamp,
} from "@/lib/server/repositories/firestore/firestoreData";

function toEntity<T extends BaseEntity>(id: string, data: DocumentData): T {
  return {
    id,
    ...data,
  } as T;
}

function normalizeWriteData(
  data: Record<string, unknown>,
  mode: "create" | "update",
  options?: RepositoryWriteOptions
) {
  const withTimestamps =
    options?.addTimestamps === false
      ? data
      : mode === "create"
      ? withCreateTimestamps(data)
      : withUpdateTimestamp(data);

  return cleanUndefinedDeep(withTimestamps) as DocumentData;
}

function applyQueryOptions(
  baseQuery: Query<DocumentData>,
  options?: RepositoryListOptions
) {
  let nextQuery = baseQuery;

  options?.filters?.forEach((filter) => {
    nextQuery = nextQuery.where(
      filter.field,
      filter.operator as WhereFilterOp,
      filter.value
    );
  });

  options?.sort?.forEach((sort) => {
    nextQuery = nextQuery.orderBy(sort.field, sort.direction || "asc");
  });

  if (options?.limit && options.limit > 0) {
    nextQuery = nextQuery.limit(options.limit);
  }

  return nextQuery;
}

export class FirestoreGenericRepository<T extends BaseEntity>
  implements GenericRepository<T>
{
  readonly collectionName: string;

  constructor(collectionName: string) {
    if (!collectionName.trim()) {
      throw new Error("Repository collectionName is required.");
    }

    this.collectionName = collectionName;
  }

  private collectionRef() {
    return adminDb.collection(this.collectionName);
  }

  private docRef(id: EntityId) {
    return adminDb.collection(this.collectionName).doc(id);
  }

  async getById(id: EntityId): Promise<T | null> {
    const snap = await this.docRef(id).get();

    if (!snap.exists) return null;

    return toEntity<T>(snap.id, snap.data() || {});
  }

  async exists(id: EntityId): Promise<boolean> {
    const snap = await this.docRef(id).get();
    return snap.exists;
  }

  async list(options?: RepositoryListOptions) {
    const ref = applyQueryOptions(this.collectionRef(), options);
    const snap = await ref.get();
    const items = snap.docs.map((item) => toEntity<T>(item.id, item.data()));

    return {
      items,
      count: items.length,
    };
  }

  async create(
    data: CreateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T> {
    const payload = normalizeWriteData(
      data as Record<string, unknown>,
      "create",
      options
    );
    const ref = await this.collectionRef().add(payload);
    const created = await this.getById(ref.id);

    if (!created) {
      throw new Error(`Failed to read created document: ${this.collectionName}/${ref.id}`);
    }

    return created;
  }

  async set(
    id: EntityId,
    data: CreateEntityInput<T> | UpdateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T> {
    const payload = normalizeWriteData(
      data as Record<string, unknown>,
      "create",
      options
    );

    await this.docRef(id).set(payload, { merge: options?.merge ?? true });

    const saved = await this.getById(id);
    if (!saved) {
      throw new Error(`Failed to read saved document: ${this.collectionName}/${id}`);
    }

    return saved;
  }

  async update(
    id: EntityId,
    data: UpdateEntityInput<T>,
    options?: RepositoryWriteOptions
  ): Promise<T> {
    const payload = normalizeWriteData(
      data as Record<string, unknown>,
      "update",
      options
    );

    await this.docRef(id).update(payload);

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Failed to read updated document: ${this.collectionName}/${id}`);
    }

    return updated;
  }

  async delete(id: EntityId): Promise<void> {
    await this.docRef(id).delete();
  }
}
