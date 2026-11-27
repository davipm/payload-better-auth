import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { betterAuthPlugin } from '@davipm/payload-better-auth';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { sharpTransformer } from '@payloadcms/transformer-sharp';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildConfig, type CollectionConfig } from 'payload';
import { Projects } from './collections/projects.js';
import { Users } from './collections/users.js';
import { testEmailAdapter } from './helpers/testEmailAdapter.js';
import { payloadAuthOptions } from './lib/auth.js';
import type {} from './payload-types.js';
import { seed } from './seed.js';
import { getServerSideURL } from './utils/get-url.js';

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
      importMap: { baseDir: path.resolve(dirname) },
    },
    collections: [Projects as unknown as CollectionConfig, Users as unknown as CollectionConfig],
    cors: [getServerSideURL()].filter(Boolean),
    db: postgresAdapter({
      disableCreateDatabase: false,
      pool: { connectionString: process.env.DATABASE_URL },
      push: true, // Keep the demo database schema in sync during development. Production uses migrations.
      migrationDir: path.resolve(dirname, 'migrations'),
    }),
    email: testEmailAdapter,
    editor: lexicalEditor(),
    onInit: async (payload) => {
      await seed(payload);
    },
    plugins: [betterAuthPlugin(payloadAuthOptions)],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
    upload: {
      transformers: [sharpTransformer()],
    },
    typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  });
};

export default buildConfigWithMemoryDB();
