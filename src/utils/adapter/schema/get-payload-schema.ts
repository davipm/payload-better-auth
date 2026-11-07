import fs from 'node:fs/promises';
import path from 'node:path';

export const SCHEMA_FILE = 'schema.ts';

const isErrno = (e: unknown): e is NodeJS.ErrnoException => e instanceof Error && 'code' in e;

/**
 * Reads `<payloadDirPath>/schema.ts`.
 * @returns the file contents, or '' if the directory exists but has no schema file yet.
 * @throws if the directory is missing or unreadable.
 */
export const getPayloadSchema = async (payloadDirPath: string): Promise<string> => {
  const dir = path.resolve(payloadDirPath);
  const file = path.join(dir, SCHEMA_FILE);

  // Directory check is kept separate so a missing *directory* (config error)
  // is distinguishable from a missing *file* (first run, not an error).
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new Error(`PayloadAdapter: "${dir}" exists but is not a directory.`);
    }
  } catch (error) {
    if (isErrno(error) && error.code === 'ENOENT') {
      throw new Error(
        `Payload directory not found at "${dir}". Run this CLI from the project root, or set ` +
          `schema_generation.payload_dir_path in your payloadAdapter options.`,
        { cause: error },
      );
    }
    if (error instanceof Error && error.message.startsWith('PayloadAdapter:')) throw error;
    throw new Error(`PayloadAdapter: Failed to access payload directory at "${dir}".`, {
      cause: error,
    });
  }

  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (isErrno(error) && error.code === 'ENOENT') return '';
    throw new Error(`PayloadAdapter: Failed to read ${SCHEMA_FILE} from "${dir}".`, {
      cause: error,
    });
  }
};
