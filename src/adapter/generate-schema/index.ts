import fs from 'node:fs/promises';
import path from 'node:path';
import type { BetterAuthOptions } from 'better-auth';
import { generateSchemaBuilderStage } from './generate-schema-builder.js';
import { getPayloadSchema, SCHEMA_FILE } from './get-payload-schema.js'; // export SCHEMA_FILE there

export type GenerateSchemaOptions = { outputDir?: string };

/** Atomic write: a crash mid-write can't leave a truncated schema.ts behind. */
async function writeFileAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Generates `<outputDir>/schema.ts` from the BetterAuth options, preserving existing collections.
 * @returns the generated source.
 */
export const generateSchema = async (
  baOptions: BetterAuthOptions,
  { outputDir = './generated' }: GenerateSchemaOptions = {},
): Promise<string> => {
  const dir = path.resolve(outputDir);
  const schemaPath = path.join(dir, SCHEMA_FILE);

  const existing = await getPayloadSchema(dir);
  const generated = await generateSchemaBuilderStage({ code: existing, BAOptions: baOptions });

  // Skip to write when nothing changed: keeps mtime stable so watchers/HMR don't re-trigger.
  if (generated !== existing) {
    try {
      await writeFileAtomic(schemaPath, generated);
    } catch (error) {
      throw new Error(`PayloadAdapter: Failed to write ${SCHEMA_FILE} to "${dir}".`, {
        cause: error,
      });
    }
  }

  return generated;
};
