import { BetterAuthError, type BetterAuthOptions, type Where } from 'better-auth';
import type { DBFieldAttribute } from 'better-auth/db';
import { getAuthTables } from 'better-auth/db';
import {
  type BasePayload,
  type CollectionSlug,
  flattenAllFields,
  type Where as PayloadWhere,
} from 'payload';
import type { ModelKey } from '../../types/generated-types.js';
import {
  getCollectionByModelKey,
  getCollectionFieldNameByFieldKeyUntyped,
  getFieldKeyByCollectionFieldName,
} from '../plugin/get-collection.js';

type IdType = 'number' | 'text';
type FlatFields = ReturnType<typeof flattenAllFields>;
type Obj = Record<string, any>;

const ERR = '[payload-db-adapter]';
const isIdKey = (k: string) => k === 'id' || k === '_id';
const isRef = (x: any): x is { id: unknown } => typeof x === 'object' && x !== null && 'id' in x;

const OPERATORS = new Map<string, (v: any) => Obj>([
  ['eq', (v) => ({ equals: v })],
  ['ne', (v) => ({ not_equals: v })],
  ['gt', (v) => ({ greater_than: v })],
  ['gte', (v) => ({ greater_than_equal: v })],
  ['lt', (v) => ({ less_than: v })],
  ['lte', (v) => ({ less_than_equal: v })],
  ['contains', (v) => ({ contains: v })],
  ['in', (v) => ({ in: v })],
  ['not_in', (v) => ({ not_in: v })],
  ['starts_with', (v) => ({ like: `${v}%` })],
  ['ends_with', (v) => ({ like: `%${v}` })],
]);

function operatorToPayload(operator: string, value: any): Obj {
  const fn = OPERATORS.get(operator);
  if (!fn) throw new BetterAuthError(`${ERR} Unsupported where operator "${operator}"`);
  return fn(value);
}

/** Coerce a primitive id to the configured idType; leaves non-coercible values untouched. */
function coerceId(value: unknown, idType: IdType): unknown {
  if (idType === 'number' && typeof value === 'string') {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (idType === 'text' && typeof value === 'number') return String(value);
  return value;
}

export const createTransform = (options: BetterAuthOptions, enableDebugLogs: boolean) => {
  const schema = getAuthTables(options);

  // BA core hardcodes session.userId / account.userId `references.model` to the literal
  // model key "user". getForwardRelationFieldNames() matches against the resolved Payload
  // slug ("users"), so patch once here; otherwise `join: { user: true }` finds no field
  // (or wrongly matches session.impersonatedBy when the admin plugin is enabled).
  const resolvedUserSlug = schema?.user?.modelName;
  if (resolvedUserSlug) {
    for (const m of ['session', 'account'] as const) {
      const ref = schema[m]?.fields?.userId?.references;
      if (ref) ref.model = resolvedUserSlug;
    }
  }

  const debugLog = enableDebugLogs
    ? (message: any[]) => console.log('[payload-db-adapter]', ...message)
    : () => {};

  /* ----------------------------- model / field resolution ----------------------------- */

  function getCollectionSlug(model: ModelKey): CollectionSlug {
    const slug = schema?.[model]?.modelName || model;
    debugLog(['getCollectionSlug:', { model, resolvedSlug: slug }]);
    return slug as CollectionSlug;
  }

  const modelKeyCache = new Map<string, ModelKey>();

  /** Accepts a BA model key ("user") or a Payload slug ("users") and returns the BA model key. */
  function resolveModelKey(model: string): ModelKey {
    const cached = modelKeyCache.get(model);
    if (cached) return cached;

    let resolved = model;
    if (!schema?.[model]) {
      const hit = Object.entries(schema).find(([, v]) => v.modelName === model);
      if (hit) resolved = hit[0];
    }
    modelKeyCache.set(model, resolved as ModelKey);
    return resolved as ModelKey;
  }

  function getFieldName(model: ModelKey, field: string): string {
    if (isIdKey(field)) return field;
    const fieldName = schema[model]?.fields[field]?.fieldName || field;
    debugLog(['getField: ', { model, originalField: field, fieldName }]);
    return fieldName;
  }

  /** BA field key -> schema fieldName -> Payload collection field name. */
  function toPayloadFieldName(model: ModelKey, field: string, payload?: BasePayload): string {
    const schemaFieldName = getFieldName(model, field);
    if (!payload) return schemaFieldName;
    return getCollectionFieldNameByFieldKeyUntyped(
      getCollectionByModelKey(payload.collections, model),
      schemaFieldName,
    );
  }

  /**
   * Payload field name(s) on `model` holding a forward relationship to `joinCollectionSlug`,
   * resolved via BA `references.model` (disambiguates e.g. session.user vs impersonatedBy).
   * Returns all matches so callers can detect ambiguity.
   */
  function getForwardRelationFieldNames(model: ModelKey, joinCollectionSlug: string): string[] {
    const fields = schema[model]?.fields;
    if (!fields) return [];
    return Object.entries(fields)
      .filter(([, f]) => f.references?.model === joinCollectionSlug)
      .map(([key]) => getFieldName(model, key));
  }

  const isRelationshipField = (key: string, fields: Record<string, DBFieldAttribute>) =>
    fields[key]?.references !== undefined;

  /* ------------------------------- payload field lookups ------------------------------- */

  // Keyed by collection config so a rebuilt Payload instance never serves stale fields.
  const flatFieldsCache = new WeakMap<object, FlatFields>();

  function getFlatFields(payload: BasePayload, slug: string): FlatFields | undefined {
    const config = payload.collections[slug as CollectionSlug]?.config;
    if (!config) return undefined;
    let flat = flatFieldsCache.get(config);
    if (!flat) {
      flat = flattenAllFields({ fields: config.fields });
      flatFieldsCache.set(config, flat);
    }
    return flat;
  }

  const getPayloadField = (payload: BasePayload, slug: string, name: string) =>
    getFlatFields(payload, slug)?.find((f) => f.name === name);

  function isPayloadRelationship(payload: BasePayload, slug: string, name: string): boolean {
    const type = getPayloadField(payload, slug, name)?.type;
    return type === 'relationship' || type === 'upload';
  }

  /** Scopes BA's comma-string <-> array role conversion to hasMany selects (users.role). */
  function isHasManySelectField(payload: BasePayload, slug: string, name: string): boolean {
    const f = getPayloadField(payload, slug, name);
    return f?.type === 'select' && (f as { hasMany?: boolean }).hasMany === true;
  }

  /* ------------------------------------ id queries ------------------------------------ */

  function singleIdQuery(where: PayloadWhere): string | number | null {
    if (!where || 'and' in where || 'or' in where) return null;
    const idField = 'id' in where ? 'id' : '_id' in where ? '_id' : null;
    if (!idField) return null;

    const cond = where[idField];
    if (!cond || typeof cond !== 'object' || Array.isArray(cond)) return null;

    const candidate =
      'equals' in cond
        ? cond.equals
        : 'contains' in cond && Array.isArray(cond.contains) && cond.contains.length === 1
          ? cond.contains[0]
          : undefined;

    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null;
  }

  /* ---------------------------------- input transform ---------------------------------- */

  function normalizeData({
    key,
    value,
    isRelatedField,
    idType,
    isHasManySelect,
  }: {
    key: string;
    value: any;
    isRelatedField: boolean;
    idType: IdType;
    isHasManySelect: boolean;
  }) {
    if (value === null || value === undefined) return value;

    if (isIdKey(key) || isRelatedField) {
      const converted = Array.isArray(value)
        ? value.map((v) => (v == null ? v : coerceId(v, idType)))
        : coerceId(value, idType);
      debugLog([`ID conversion: ${key}`, { original: value, converted }]);
      return converted;
    }

    // Casing preserved so roles like "orgOwner" survive select validation (ADAPTER-10).
    // member/invitation store role as plain text and must pass through (#112).
    if ((key === 'role' || key === 'roles') && isHasManySelect) {
      const trim = (r: unknown) => (typeof r === 'string' ? r.trim() : r);
      if (Array.isArray(value)) return value.map(trim);
      if (typeof value === 'string') return value.split(',').map(trim);
    }

    return value;
  }

  function transformInput({
    data,
    model: rawModel,
    idType,
    payload,
  }: {
    data: Obj;
    model: ModelKey;
    idType: IdType;
    payload: BasePayload;
  }): Obj {
    const model = resolveModelKey(rawModel);
    const schemaFields = schema?.[model]?.fields ?? {};
    const collectionSlug = getCollectionSlug(model);
    const collection = getCollectionByModelKey(payload.collections, model);
    const out: Obj = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue; // null passes through to clear fields

      const targetFieldName = schemaFields[key]?.fieldName || key;
      const isRelatedField =
        isRelationshipField(key, schemaFields) ||
        isPayloadRelationship(payload, collectionSlug, targetFieldName);
      const isHasManySelect = isHasManySelectField(payload, collectionSlug, targetFieldName);

      out[getCollectionFieldNameByFieldKeyUntyped(collection, targetFieldName)] = normalizeData({
        idType,
        key,
        value,
        isRelatedField,
        isHasManySelect,
      });
    }

    return out;
  }

  /* ---------------------------------- output transform ---------------------------------- */

  const isJoinResult = (v: any): v is { docs: any[] } =>
    v !== null && typeof v === 'object' && Array.isArray(v.docs);

  /** Flattens { docs } joins, unwrapping polymorphic { relationTo, value } entries. */
  const flattenJoinResult = (join: { docs: any[] }): any[] =>
    join.docs.map((item) =>
      item && typeof item === 'object' && 'value' in item && 'relationTo' in item
        ? item.value
        : item,
    );

  /**
   * Writes BA-facing string ids under `originalKey` (always wins) and, when the field is
   * renamed, keeps the Payload-shaped (possibly populated) value under `fieldName`.
   */
  function normalizeDocumentIds(result: Obj, originalKey: string, fieldName: string, value: any) {
    const keepPayloadShape = fieldName !== originalKey;
    const withStringId = (x: { id: unknown }) => ({ ...x, id: String(x.id) });

    if (typeof value === 'string' || typeof value === 'number') {
      if (keepPayloadShape) result[fieldName] = value;
      result[originalKey] = String(value);
      return;
    }

    if (isRef(value)) {
      if (keepPayloadShape) result[fieldName] = withStringId(value);
      result[originalKey] = String(value.id);
      return;
    }

    if (Array.isArray(value) && value.length > 0) {
      if (value.every(isRef)) {
        if (keepPayloadShape) result[fieldName] = value.map(withStringId);
        result[originalKey] = value.map((i) => String(i.id));
      } else {
        if (keepPayloadShape) result[fieldName] = [...value];
        result[originalKey] = value.map((i) => String(i));
      }
    }
  }

  function transformOutput<T extends Obj | null>({
    doc,
    model: rawModel,
    payload,
  }: {
    doc: T;
    model: ModelKey;
    payload: BasePayload;
  }): T {
    if (!doc || typeof doc !== 'object') return doc;

    const model = resolveModelKey(rawModel);
    const schemaFields = schema?.[model]?.fields ?? {};
    const collectionSlug = getCollectionSlug(model);
    const collection = getCollectionByModelKey(payload.collections, model);
    const flat = getFlatFields(payload, collectionSlug);
    const toBaKey = (k: string) => getFieldKeyByCollectionFieldName(collection, k);

    // payload field name -> BA field key (first match wins)
    const relByName = new Map<string, string>();
    const dateByName = new Map<string, string>();
    for (const [k, f] of Object.entries(schemaFields)) {
      const mapped = f.fieldName || k;
      if (
        !relByName.has(mapped) &&
        (isRelationshipField(k, schemaFields) ||
          isPayloadRelationship(payload, collectionSlug, mapped))
      ) {
        relByName.set(mapped, k);
      }
      if (f.type === 'date' && !dateByName.has(mapped)) dateByName.set(mapped, k);
    }

    const result: Obj = { ...doc };

    // 1. rename keys to BA keys
    for (const key of Object.keys(result)) {
      const baKey = toBaKey(key);
      if (baKey !== key) {
        result[baKey] = result[key];
        delete result[key];
      }
    }

    // 2. per-field normalization, driven by the original doc
    for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) continue;
      const baKey = toBaKey(key);

      if (isIdKey(key)) {
        result[baKey] = String(value);
        continue;
      }

      if ((baKey === 'role' || baKey === 'roles') && Array.isArray(value)) {
        result[baKey] = value.join(',');
        continue;
      }

      if (isJoinResult(value)) {
        debugLog(['transformOutput: flattening join result', { key, baKey }]);
        const docs = flattenJoinResult(value);
        const joinField = flat?.find((f: any) => f.type === 'join' && f.name === key) as
          | { collection?: unknown }
          | undefined;

        if (typeof joinField?.collection === 'string') {
          const joinedModel = resolveModelKey(joinField.collection);
          result[baKey] = docs.map((d) => transformOutput({ doc: d, model: joinedModel, payload }));
        } else {
          result[baKey] = docs;
        }
        continue;
      }

      const relKey = relByName.get(key);
      if (relKey) {
        normalizeDocumentIds(result, relKey, key, value);
        continue;
      }

      if (dateByName.has(key)) {
        result[baKey] = value instanceof Date ? value : new Date(value);
      }
    }

    // 3. strip Payload-internal keys; keep BA schema fields AND Payload collection fields
    //    (plugin-added fields like role/token/url on admin-invitations must survive)
    if (Object.keys(schemaFields).length > 0) {
      const allowed = new Set<string>([
        'id',
        '_id',
        ...Object.keys(schemaFields),
        ...(flat?.map((f) => f.name) ?? []),
      ]);
      for (const key of Object.keys(result)) {
        if (!allowed.has(key)) delete result[key];
      }
    }

    return result as T;
  }

  /* ------------------------------------ where / select / sort ------------------------------------ */

  function convertWhereValue({
    value,
    fieldName,
    originalFieldKey,
    model,
    idType,
  }: {
    value: any;
    fieldName: string;
    originalFieldKey?: string;
    model: ModelKey;
    idType: IdType;
  }): any {
    const lookupKey = originalFieldKey ?? fieldName;
    const schemaFields = schema?.[model]?.fields ?? {};
    if (!isIdKey(fieldName) && !isRelationshipField(lookupKey, schemaFields)) return value;

    if (Array.isArray(value)) {
      return value.map((v) =>
        convertWhereValue({ value: v, fieldName, originalFieldKey, model, idType }),
      );
    }

    const raw = isRef(value) ? value.id : value;

    // Fail loudly: an uncoercible/missing id otherwise reaches Postgres as an opaque `params: NaN`.
    if (idType === 'number') {
      if (typeof raw === 'string') {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          throw new BetterAuthError(
            `${ERR} Cannot convert "${raw}" on relationship/ID field "${lookupKey}" (model: "${model}") to a numeric ID (idType: "number").`,
          );
        }
        return n;
      }
      if (raw === undefined) {
        throw new BetterAuthError(
          `${ERR} Missing value for relationship/ID field "${lookupKey}" (model: "${model}") in where clause — expected a numeric ID but received undefined. This usually means an upstream reference (e.g. a forward-joined session.user) was not populated.`,
        );
      }
    }

    return coerceId(raw, idType);
  }

  function convertWhereClause({
    idType,
    model: rawModel,
    where,
    payload,
  }: {
    idType: IdType;
    model: ModelKey;
    where?: Where[];
    payload: BasePayload;
  }): PayloadWhere {
    if (!where?.length) return {};
    const model = resolveModelKey(rawModel);

    const toCondition = (w: Where): Obj => {
      const fieldName = getFieldName(model, w.field);
      const value = convertWhereValue({
        value: w.value,
        fieldName,
        originalFieldKey: w.field,
        model,
        idType,
      });
      return {
        [toPayloadFieldName(model, w.field, payload)]: operatorToPayload(w.operator ?? 'eq', value),
      };
    };

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    if (where.length === 1) return toCondition(where[0]!) as PayloadWhere;

    // Connector defaults to AND
    const and: Obj[] = [];
    const or: Obj[] = [];
    for (const w of where) (w.connector === 'OR' ? or : and).push(toCondition(w));

    return {
      ...(and.length ? { and } : {}),
      ...(or.length ? { or } : {}),
    } as PayloadWhere;
  }

  function convertSelect(rawModel: ModelKey, select?: string[], payload?: BasePayload) {
    if (!select?.length) return undefined;
    const model = resolveModelKey(rawModel);
    return Object.fromEntries(
      select.map((f) => [toPayloadFieldName(model, f, payload), true as const]),
    ) as Record<string, true>;
  }

  function convertSort(
    rawModel: ModelKey,
    sortBy?: { field: string; direction: 'asc' | 'desc' },
    payload?: BasePayload,
  ): string | undefined {
    if (!sortBy) return undefined;
    const name = toPayloadFieldName(resolveModelKey(rawModel), sortBy.field, payload);
    return `${sortBy.direction === 'desc' ? '-' : ''}${name}`;
  }

  return {
    getFieldName,
    getCollectionSlug,
    getForwardRelationFieldNames,
    singleIdQuery,
    transformInput,
    transformOutput,
    convertWhereClause,
    convertSelect,
    convertSort,
  };
};
