import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import collections from './collections/index.js';
import { testEmailAdapter } from './helpers/testEmailAdapter.js';
import { plugins } from './payload/plugins/index.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname;
}

const buildConfigWithMemoryDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    });

    process.env.DATABASE_URL = `${memoryDB.getUri()}&retryWrites=true`;
  }

  return buildConfig({
    admin: {
      user: 'users',
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections,
    db: postgresAdapter({
      disableCreateDatabase: false,
      pool: { connectionString: process.env.DATABASE_URL },
      // Keep the demo database schema in sync during development. Production uses migrations.
      push: true,
      migrationDir: path.resolve(dirname, 'migrations'),
    }),
    email: testEmailAdapter,
    editor: lexicalEditor(),
    // onInit: async (payload) => {
    //   await seed(payload);
    // },
    plugins: [...plugins],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  });
};

export default buildConfigWithMemoryDB();
