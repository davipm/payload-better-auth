import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { testEmailAdapter } from './helpers/testEmailAdapter.js';
import { plugins } from './payload/plugins/index.js';
import { seed } from './seed.js';

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
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'posts',
        fields: [],
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: postgresAdapter({
      disableCreateDatabase: false,
      pool: {
        connectionString: process.env.DATABASE_URL,
      },
      // Sync the demo schema in dev; production and migration commands use migrations.
      push: process.env.NODE_ENV === 'development' && process.env.PAYLOAD_MIGRATING !== 'true',
      migrationDir: path.resolve(dirname, 'migrations'),
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload);
    },
    plugins: [...plugins],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  });
};

export default buildConfigWithMemoryDB();
