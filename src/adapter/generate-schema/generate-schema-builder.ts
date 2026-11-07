import type { BetterAuthOptions } from 'better-auth';
import type { DBFieldAttribute } from 'better-auth/db';
import { getAuthTables } from 'better-auth/db';

/**
 * Generates PayloadCMS collection configs from the Better Auth schema.
 * Existing collection declarations in `code` are preserved verbatim; missing ones are generated.
 */

type Obj = Record<string, unknown>;
type Tables = ReturnType<typeof getAuthTables>;
type ExistingCollection = { name: string; slug: string; source: string };

const HEADER = `/**
 * EXAMPLE COLLECTIONS FOR BETTER AUTH
 *
 * Copy these into your Payload collection configs.
 * The users collection needs the BetterAuth strategy:
 *
 * auth: {
 *   disableLocalStrategy: true,
 *   strategies: [betterAuthStrategy()],
 * },
 */
import type { CollectionConfig } from 'payload';

`;

export const generateSchemaBuilderStage = async ({
  BAOptions,
  code,
}: {
  code: string;
  BAOptions: BetterAuthOptions;
}) => {
  const { collections, exported } = parseExistingSchema(code);
  return generatePayloadCollectionConfigs({ options: BAOptions, collections, exported });
};

/* ------------------------------- parsing existing code ------------------------------- */

const DECL = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*:\s*CollectionConfig\s*=\s*\{/g;

/** Index of the `}` matching the `{` at `open`; skips strings, templates and comments. */
function findClosingBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    const n = code[i + 1];
    if (c === '/' && n === '/') {
      i = code.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && n === '*') {
      i = code.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

function parseExistingSchema(code: string): {
  collections: ExistingCollection[];
  exported: string[];
} {
  const collections: ExistingCollection[] = [];

  for (const m of code.matchAll(DECL)) {
    const start = m.index!;
    const close = findClosingBrace(code, start + m[0].length - 1);
    if (close < 0) continue;

    const tail = code.slice(close + 1).match(/^\s*(?:as\s+const\s*)?;?/)![0];
    let source = code
      .slice(start, close + 1 + tail.length)
      .trim()
      .replace(/^export\s+/, '');
    if (!source.endsWith(';')) source += ';';

    const slug = source.match(/\bslug:\s*(['"`])([^'"`]+)\1/)?.[2] ?? m[1].toLowerCase();
    collections.push({ name: m[1], slug, source });
  }

  const exported =
    code
      .match(/export\s*\{([^}]*)\}/)?.[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return { collections, exported };
}

/* ------------------------------------ serialization ------------------------------------ */

const IDENT = /^[A-Za-z_$][\w$]*$/;

const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

function toSource(v: unknown, depth = 0): string {
  const pad = '  '.repeat(depth + 1);
  const end = '  '.repeat(depth);

  if (Array.isArray(v)) {
    const items = v.map((x) => toSource(x, depth + 1));
    const flat = `[${items.join(', ')}]`;
    return flat.length <= 60 && !flat.includes('\n')
      ? flat
      : `[\n${items.map((i) => pad + i).join(',\n')},\n${end}]`;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) return '{}';
    const body = entries
      .map(([k, x]) => `${pad}${IDENT.test(k) ? k : JSON.stringify(k)}: ${toSource(x, depth + 1)}`)
      .join(',\n');
    return `{\n${body},\n${end}}`;
  }
  if (typeof v === 'string') {
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  }
  return String(v);
}

/* ---------------------------------- schema -> payload ---------------------------------- */

const TYPE_MAP: Record<string, string> = {
  string: 'text',
  number: 'number',
  boolean: 'checkbox',
  date: 'date',
  json: 'json',
};

const SKIPPED_FIELDS = new Set(['id', 'createdAt', 'updatedAt']); // Payload manages these

/** Primitive defaults only; thunks are evaluated, Dates/objects are dropped. */
function resolveDefault(d: unknown): string | number | boolean | undefined {
  try {
    const v = typeof d === 'function' ? d() : d;
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : undefined;
  } catch {
    return undefined;
  }
}

function buildField(key: string, f: DBFieldAttribute, tables: Tables): Obj | null {
  const rawName = f.fieldName || key;
  if (SKIPPED_FIELDS.has(rawName)) return null;

  const out: Obj = { name: rawName };
  const refModel = f.references?.model;
  const legacyRel = /_id$/.test(rawName);

  if (refModel || legacyRel) {
    // BA hardcodes some refs to the model key ("user"); resolve to the configured slug ("users").
    out.name = rawName.replace(/_id$/, '');
    out.type = 'relationship';
    out.relationTo = refModel ? (tables[refModel]?.modelName ?? refModel) : out.name;
  } else if (Array.isArray(f.type)) {
    out.type = 'select';
    out.options = f.type;
  } else if (f.type === 'string[]' || f.type === 'number[]') {
    out.type = f.type === 'string[]' ? 'text' : 'number';
    out.hasMany = true;
  } else {
    out.type = rawName === 'email' ? 'email' : (TYPE_MAP[f.type as string] ?? 'text');
  }

  if (f.required) out.required = true;
  if (f.unique) out.unique = true;

  const def = resolveDefault(f.defaultValue);
  if (def !== undefined) out.defaultValue = def;

  if (f.input === false) out.admin = { readOnly: true };

  return out;
}

const TITLE_CANDIDATES = ['name', 'title', 'label', 'email', 'username'];

function buildCollection(tableKey: string, table: Tables[string], tables: Tables): Obj {
  const fields = Object.entries(table.fields)
    .map(([k, f]) => buildField(k, f, tables))
    .filter((f): f is Obj => f !== null);

  const titleNames = fields.filter((f) => f.type !== 'relationship').map((f) => f.name as string);
  const useAsTitle = TITLE_CANDIDATES.find((n) => titleNames.includes(n)) ?? titleNames[0] ?? 'id';

  return {
    slug: table.modelName,
    admin: { useAsTitle },
    // Keyed on the BA model key, not the (configurable) Payload slug.
    ...(tableKey === 'user' && { auth: { disableLocalStrategy: true, strategies: [] } }),
    fields,
    timestamps: true,
  };
}

function generatePayloadCollectionConfigs({
  options,
  collections,
  exported,
}: {
  options: BetterAuthOptions;
  collections: ExistingCollection[];
  exported: string[];
}): string {
  const tables = getAuthTables(options);
  const existing = new Map(collections.map((c) => [c.slug, c]));
  const names = new Set(exported);
  const seen = new Set<string>();
  const blocks: string[] = [];

  for (const [tableKey, table] of Object.entries(tables)) {
    const slug = table.modelName;
    seen.add(slug);

    const prior = existing.get(slug);
    const name = prior?.name ?? pascal(slug);
    names.add(name);

    blocks.push(
      prior?.source ??
        `const ${name}: CollectionConfig = ${toSource(buildCollection(tableKey, table, tables))};`,
    );
  }

  // Collections the user already has that BA doesn't know about
  for (const c of collections) {
    if (seen.has(c.slug)) continue;
    names.add(c.name);
    blocks.push(c.source);
  }

  return `${HEADER}${blocks.join('\n\n')}\n\nexport { ${[...names].join(', ')} };\n`;
}
