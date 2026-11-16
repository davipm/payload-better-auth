import type { BetterAuthOptions, DBAdapter, Where } from 'better-auth';
import { BetterAuthError } from 'better-auth';
import {
  type BasePayload,
  type CollectionSlug,
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type PayloadRequest,
  type Where as PayloadWhere,
} from 'payload';
import type { ModelKey } from '../types/generated-types.js';
import type { PayloadAdapter } from '../types/adapter.js';
import { generateSchema } from '../utils/adapter/generate-schema.js';
import { createTransform } from '../utils/adapter/transform.js';

export const BETTER_AUTH_CONTEXT_KEY = 'payload-db-adapter';
const LOG = '[payload-db-adapter]';
const DEPTH = 0;

type Doc = Record<string, any>;
type Req = Partial<PayloadRequest>;

/** Better Auth join option type (not exported from better-auth yet) */
type JoinOption = Record<string, boolean | { limit?: number }>;

type Scope = {
  payload: BasePayload;
  slug: CollectionSlug;
  req?: Req;
  where: (w?: Where[]) => PayloadWhere;
  input: (data: Doc) => Doc;
  out: (doc: Doc) => Doc;
  ctx: (operation: string) => Doc;
};

const isNotFound = (e: unknown) =>
  e instanceof Error && 'status' in e && (e as { status?: number }).status === 404;

/** Payload's bulk update/delete report per-document failures in `errors` instead of throwing. */
function assertNoBulkErrors(res: { errors?: unknown[] }, op: string) {
  if (res.errors?.length) {
    throw new BetterAuthError(
      `${LOG} ${op} failed for ${res.errors.length} document(s): ${JSON.stringify(res.errors)}`,
    );
  }
}

function assertCollection(payload: BasePayload, slug: string, model: string) {
  if (!slug || !(slug in payload.collections)) {
    throw new BetterAuthError(
      `Collection "${model}" (slug "${slug}") does not exist. Check that your Payload collection slugs match the Better Auth schema.`,
    );
  }
}

const joinFieldsCache = new WeakMap<object, { name: string; collection: string }[]>();

const payloadAdapter: PayloadAdapter = ({ payloadClient, adapterConfig }) => {
  const debugLog = (message: any[]) => {
    if (adapterConfig.enableDebugLogs) console.log(LOG, ...message);
  };
  const errorLog = (message: any[]) => console.error(LOG, ...message);

  const createAdapterContext = (data: Doc) => ({ [BETTER_AUTH_CONTEXT_KEY]: { ...data } });

  // Cache the promise (not the value) so concurrent first calls don't resolve twice;
  // failures are not cached.
  let payloadPromise: Promise<BasePayload> | null = null;
  function resolvePayloadClient(): Promise<BasePayload> {
    payloadPromise ??= (async () => {
      const payload = await (typeof payloadClient === 'function' ? payloadClient() : payloadClient);
      if (!payload.config?.custom?.hasBetterAuthPlugin) {
        throw new BetterAuthError(
          'Payload is not configured with the better-auth plugin. Please add the plugin to your payload config.',
        );
      }
      return payload;
    })().catch((e) => {
      payloadPromise = null;
      throw e;
    });
    return payloadPromise;
  }

  const useTransactions = (adapterConfig as { transactions?: boolean }).transactions !== false;

  return (options: BetterAuthOptions): DBAdapter => {
    const {
      transformInput,
      transformOutput,
      convertWhereClause,
      convertSelect,
      convertSort,
      getCollectionSlug,
      getForwardRelationFieldNames,
      singleIdQuery,
    } = createTransform(options, adapterConfig.enableDebugLogs ?? false);

    /* ------------------------------------- joins ------------------------------------- */

    function getJoinFields(payload: BasePayload, slug: string) {
      const config = payload.collections[slug as CollectionSlug]?.config;
      if (!config?.flattenedFields) return [];
      let cached = joinFieldsCache.get(config);
      if (!cached) {
        cached = config.flattenedFields
          .filter((f: any) => f.type === 'join')
          .map((f: any) => ({ name: f.name as string, collection: f.collection as string }));
        joinFieldsCache.set(config, cached);
      }
      return cached;
    }

    /**
     * Reverse join field on `slug` targeting the model's collection. Matches by target
     * collection, not name ("account" model -> join field targeting "accounts").
     * Null means there is no reverse join, so a forward join may apply.
     */
    function resolveJoinFieldName(payload: BasePayload, slug: string, modelKey: string) {
      const target = getCollectionSlug(modelKey as ModelKey);
      return getJoinFields(payload, slug).find((f) => f.collection === target)?.name ?? null;
    }

    function buildPayloadJoins(join: JoinOption | undefined, { payload, slug }: Scope) {
      if (!join) return undefined;
      const joins: Record<string, Doc> = {};
      for (const [modelKey, config] of Object.entries(join)) {
        if (!config) continue;
        const name = resolveJoinFieldName(payload, slug, modelKey);
        if (!name) {
          debugLog([
            `join skipped (reverse): no join field targeting '${getCollectionSlug(modelKey as ModelKey)}' on ${slug}, will attempt forward join`,
          ]);
          continue;
        }
        joins[name] = config === true ? {} : { ...config };
      }
      return Object.keys(joins).length ? joins : undefined;
    }

    /**
     * Forward (many-to-one) relationship field on `slug` for a requested join model.
     * Prefers the BA schema's `references.model` (disambiguates session.user vs
     * session.impersonatedBy), then falls back to the first Payload relationTo match.
     */
    function resolveForwardField(
      { payload, slug }: Scope,
      model: string,
      joinModelKey: string,
    ): string | null {
      const joinSlug = getCollectionSlug(joinModelKey as ModelKey);
      const fields: any[] = payload.collections[slug]?.config.flattenedFields ?? [];

      const candidates = getForwardRelationFieldNames(model as ModelKey, joinSlug).filter((n) =>
        fields.some((f) => f.name === n),
      );
      if (candidates.length) {
        if (candidates.length > 1 && !candidates.includes(joinModelKey)) {
          errorLog([
            `forward join ambiguous for '${joinModelKey}' on ${slug}: candidates [${candidates.join(', ')}] target '${joinSlug}', using '${candidates[0]}'`,
          ]);
        }
        return candidates.includes(joinModelKey) ? joinModelKey : candidates[0]!;
      }

      const rel = fields.find(
        (f) =>
          (f.type === 'relationship' || f.type === 'upload') &&
          'relationTo' in f &&
          (Array.isArray(f.relationTo)
            ? f.relationTo.includes(joinSlug)
            : f.relationTo === joinSlug),
      );
      return rel?.name ?? null;
    }

    /**
     * Populates forward joins that Payload join fields can't express. One batched query
     * per requested join, regardless of how many docs are being populated.
     */
    async function populateForwardJoins(docs: Doc[], model: string, join: JoinOption, s: Scope) {
      for (const [joinModelKey, cfg] of Object.entries(join)) {
        if (!cfg) continue;
        if (resolveJoinFieldName(s.payload, s.slug, joinModelKey)) continue; // handled natively

        const field = resolveForwardField(s, model, joinModelKey);
        if (!field) {
          errorLog([
            `join requested for '${joinModelKey}' on ${s.slug} but no reverse join field or forward relationship field could be resolved`,
          ]);
          continue;
        }

        const ids = new Set<string | number>();
        for (const d of docs) {
          const v = d[field];
          if (typeof v === 'string' || typeof v === 'number') ids.add(v); // skip populated/empty
        }
        if (!ids.size) continue;

        try {
          const { docs: related } = await s.payload.find({
            collection: getCollectionSlug(joinModelKey as ModelKey),
            where: { id: { in: [...ids] } },
            depth: DEPTH,
            limit: ids.size,
            pagination: false,
            req: s.req,
            context: s.ctx('forwardJoin'),
          });
          // Transform like reverse-joined docs so shapes match.
          const byId = new Map(
            related.map((r: Doc) => [
              String(r.id),
              transformOutput({ doc: r, model: joinModelKey as ModelKey, payload: s.payload }),
            ]),
          );
          for (const d of docs) {
            const v = d[field];
            if (v == null) continue;
            const hit = byId.get(String(v));
            if (hit) d[field] = hit;
          }
        } catch (error) {
          errorLog([`forward join lookup failed for '${joinModelKey}' on ${s.slug}:`, error]);
        }
      }
    }

    /* ---------------------------------- operations ---------------------------------- */

    const build = (req?: Req): Omit<DBAdapter, 'transaction'> => {
      /** Shared prologue/epilogue: resolve payload + slug, validate, scope helpers, log, 404 handling. */
      async function run<T>(
        op: string,
        model: string,
        fn: (s: Scope) => Promise<T>,
        onNotFound?: () => T,
      ): Promise<T> {
        const start = Date.now();
        const payload = await resolvePayloadClient();
        const slug = getCollectionSlug(model as ModelKey);
        assertCollection(payload, slug, model);

        const s: Scope = {
          payload,
          slug,
          req,
          where: (where) =>
            convertWhereClause({
              idType: adapterConfig.idType,
              model: model as ModelKey,
              where,
              payload,
            }),
          input: (data) =>
            transformInput({
              data,
              model: model as ModelKey,
              idType: adapterConfig.idType,
              payload,
            }),
          out: (doc) => transformOutput({ doc, model: model as ModelKey, payload }),
          ctx: (operation) => createAdapterContext({ model, operation }),
        };

        try {
          const result = await fn(s);
          debugLog([`${op} result`, { slug, result, duration: `${Date.now() - start}ms` }]);
          return result;
        } catch (error) {
          if (onNotFound && isNotFound(error)) return onNotFound();
          errorLog([`Error in ${op}:`, model, error]);
          throw error;
        }
      }

      /** First doc matching `where`: by-ID fast path when possible, else limit 1 (no count query). */
      async function findFirst(
        s: Scope,
        where: PayloadWhere,
        opById: string,
        opByWhere = opById,
        extra: Doc = {},
      ): Promise<Doc | null> {
        const id = singleIdQuery(where);
        if (id != null) {
          return (await s.payload.findByID({
            collection: s.slug,
            id,
            depth: DEPTH,
            disableErrors: true,
            req: s.req,
            context: s.ctx(opById),
            ...extra,
          })) as Doc | null;
        }
        const res = await s.payload.find({
          collection: s.slug,
          where,
          depth: DEPTH,
          limit: 1,
          pagination: false,
          req: s.req,
          context: s.ctx(opByWhere),
          ...extra,
        });
        return (res.docs[0] as Doc | undefined) ?? null;
      }

      return {
        id: 'payload-adapter',

        async create<T extends Doc, R = T>({
          model,
          data,
          select,
        }: {
          model: string;
          data: T;
          select?: string[];
        }): Promise<R> {
          return run('create', model, async (s) => {
            const input = s.input(data);
            debugLog(['create', { slug: s.slug, input, select }]);
            // depth 0: populated relationships would bloat the cookie-cached session.
            const doc = await s.payload.create({
              collection: s.slug,
              data: input,
              select: convertSelect(model as ModelKey, select, s.payload),
              req,
              context: s.ctx('create'),
              depth: DEPTH,
            });
            return s.out(doc) as R;
          });
        },

        async findOne<R>({
          model,
          where,
          select,
          join,
        }: {
          model: string;
          where: Where[];
          select?: string[];
          join?: JoinOption;
        }): Promise<R | null> {
          return run<R | null>(
            'findOne',
            model,
            async (s) => {
              const joins = buildPayloadJoins(join, s);
              const doc = await findFirst(s, s.where(where), 'findOneByID', 'findOneByWhere', {
                select: convertSelect(model as ModelKey, select, s.payload),
                ...(joins && { joins }),
                depth: joins ? 1 : DEPTH, // reverse joins need depth >= 1
              });
              if (!doc) return null;
              if (join) await populateForwardJoins([doc], model, join, s);
              return s.out(doc) as R;
            },
            () => null,
          );
        },

        async findMany<R>({
          model,
          where,
          limit = 10,
          sortBy,
          offset = 0,
          join,
        }: {
          model: string;
          where?: Where[];
          limit?: number;
          sortBy?: { field: string; direction: 'asc' | 'desc' };
          offset?: number;
          join?: JoinOption;
        }): Promise<R[]> {
          return run<R[]>(
            'findMany',
            model,
            async (s) => {
              const payloadWhere = s.where(where);
              const joins = buildPayloadJoins(join, s);
              const shared = { depth: joins ? 1 : DEPTH, ...(joins && { joins }), req };

              const id = offset === 0 ? singleIdQuery(payloadWhere) : null;
              let docs: Doc[];
              if (id != null) {
                const doc = await s.payload.findByID({
                  collection: s.slug,
                  id,
                  disableErrors: true,
                  context: s.ctx('findManyBySingleID'),
                  ...shared,
                });
                docs = doc ? [doc as Doc] : [];
              } else {
                // Fetch offset+limit from page 1 and slice: avoids page/limit misalignment
                // when offset % limit != 0. pagination:false skips the count query.
                const res = await s.payload.find({
                  collection: s.slug,
                  where: payloadWhere,
                  limit: offset + limit,
                  pagination: false,
                  sort: convertSort(model as ModelKey, sortBy, s.payload),
                  context: s.ctx('findManyByWhere'),
                  ...shared,
                });
                docs = res.docs.slice(offset, offset + limit) as Doc[];
              }

              if (join) await populateForwardJoins(docs, model, join, s);
              return docs.map((d) => s.out(d)) as R[];
            },
            () => [],
          );
        },

        async update<R>({
          model,
          where,
          update,
        }: {
          model: string;
          where: Where[];
          update: Record<string, unknown>;
        }): Promise<R | null> {
          return run<R | null>(
            'update',
            model,
            async (s) => {
              const payloadWhere = s.where(where);
              const data = s.input(update);
              const id = singleIdQuery(payloadWhere);

              let doc: Doc | undefined;
              if (id != null) {
                doc = await s.payload.update({
                  collection: s.slug,
                  id,
                  data,
                  depth: DEPTH,
                  req,
                  context: s.ctx('updateByID'),
                });
              } else {
                const res = await s.payload.update({
                  collection: s.slug,
                  where: payloadWhere,
                  data,
                  depth: DEPTH,
                  req,
                  context: s.ctx('updateByWhere'),
                });
                assertNoBulkErrors(res, 'update');
                doc = res.docs[0];
              }
              return doc ? (s.out(doc) as R) : null;
            },
            () => null,
          );
        },

        async updateMany({
          model,
          where,
          update,
        }: {
          model: string;
          where: Where[];
          update: Record<string, unknown>;
        }): Promise<number> {
          return run(
            'updateMany',
            model,
            async (s) => {
              const res = await s.payload.update({
                collection: s.slug,
                where: s.where(where),
                data: s.input(update),
                depth: DEPTH,
                req,
                context: s.ctx('updateMany'),
              });
              assertNoBulkErrors(res, 'updateMany');
              return res.docs.length;
            },
            () => 0,
          );
        },

        async delete({ model, where }: { model: string; where: Where[] }): Promise<void> {
          await run<void>(
            'delete',
            model,
            async (s) => {
              const payloadWhere = s.where(where);
              const id = singleIdQuery(payloadWhere);
              if (id != null) {
                await s.payload.delete({
                  collection: s.slug,
                  id,
                  depth: DEPTH,
                  req,
                  context: s.ctx('deleteByID'),
                });
              } else {
                const res = await s.payload.delete({
                  collection: s.slug,
                  where: payloadWhere,
                  depth: DEPTH,
                  req,
                  context: s.ctx('deleteByWhere'),
                });
                assertNoBulkErrors(res, 'delete');
              }
            },
            () => undefined,
          );
        },

        async deleteMany({ model, where }: { model: string; where: Where[] }): Promise<number> {
          return run(
            'deleteMany',
            model,
            async (s) => {
              const res = await s.payload.delete({
                collection: s.slug,
                where: s.where(where),
                depth: DEPTH,
                req,
                context: s.ctx('deleteMany'),
              });
              assertNoBulkErrors(res, 'deleteMany');
              return res.docs.length;
            },
            () => 0,
          );
        },

        async consumeOne<R>({
          model,
          where,
        }: {
          model: string;
          where: Where[];
        }): Promise<R | null> {
          return run<R | null>(
            'consumeOne',
            model,
            async (s) => {
              const found = await findFirst(s, s.where(where), 'consumeOneRead');
              if (!found) return null;

              // Delete by the found row's id (never the original where) so a non-unique
              // predicate can't delete extra rows. A concurrent consumer that lost the
              // race gets a 404 here, which run() maps to null.
              await s.payload.delete({
                collection: s.slug,
                id: found.id,
                depth: DEPTH,
                req,
                context: s.ctx('consumeOneDelete'),
              });
              return s.out(found) as R;
            },
            () => null,
          );
        },

        async incrementOne<R>({
          model,
          where,
          increment,
          set,
        }: {
          model: string;
          where: Where[];
          increment: Record<string, number>;
          set?: Record<string, unknown>;
        }): Promise<R | null> {
          return run<R | null>(
            'incrementOne',
            model,
            async (s) => {
              const payloadWhere = s.where(where);
              const current = await findFirst(s, payloadWhere, 'incrementOneRead');
              if (!current) return null; // where doubles as a guard (e.g. remaining > 0)

              // Read through the BA shape so renamed fields resolve correctly.
              const baCurrent = s.out(current);
              const data: Doc = { ...set };
              for (const [field, delta] of Object.entries(increment)) {
                const base = Number(baCurrent[field] ?? 0);
                if (Number.isNaN(base)) {
                  throw new BetterAuthError(
                    `${LOG} Cannot increment non-numeric field "${field}" on "${model}"`,
                  );
                }
                data[field] = base + delta;
              }

              // Pin to the row we read AND re-apply the guard (compare-and-swap).
              // Previously the update hit every row matching `where`.
              const res = await s.payload.update({
                collection: s.slug,
                where: { and: [{ id: { equals: current.id } }, payloadWhere] },
                data: s.input(data),
                depth: DEPTH,
                req,
                context: s.ctx('incrementOne'),
              });
              assertNoBulkErrors(res, 'incrementOne');
              const updated = res.docs[0];
              return updated ? (s.out(updated) as R) : null;
            },
            () => null,
          );
        },

        async count({ model, where }: { model: string; where?: Where[] }): Promise<number> {
          return run(
            'count',
            model,
            async (s) =>
              (
                await s.payload.count({
                  collection: s.slug,
                  where: s.where(where),
                  req,
                  context: s.ctx('count'),
                })
              ).totalDocs,
            () => 0,
          );
        },

        createSchema: async (opts, file) => ({
          code: await generateSchema(opts, {
            outputDir: (adapterConfig as any).schema_generation?.payload_dir_path,
          }),
          path: file || 'schema.ts',
          append: false,
          overwrite: true,
        }),

        options: {
          adapterConfig: {} as any,
          ...adapterConfig,
        },
      };
    };

    return {
      ...build(),

      /**
       * Real transaction: one Payload request carries the transaction ID, and every
       * operation inside the callback is bound to it. No-ops (initTransaction -> false)
       * when the DB adapter doesn't support transactions or one is already open.
       */
      async transaction<R>(
        callback: (tx: Omit<DBAdapter, 'transaction'>) => Promise<R>,
      ): Promise<R> {
        if (!useTransactions) return callback(build());

        const payload = await resolvePayloadClient();
        const req = await createLocalReq({}, payload);
        const started = await initTransaction(req);
        try {
          const result = await callback(build(req));
          if (started) await commitTransaction(req);
          return result;
        } catch (error) {
          if (started) await killTransaction(req);
          errorLog(['Transaction rolled back:', error]);
          throw error;
        }
      },
    };
  };
};

export { generateSchema, payloadAdapter };
