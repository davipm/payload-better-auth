import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { type BasePayload, buildConfig } from 'payload';
import sharp from 'sharp';
import collections from './payload/collections/index.js';
import { plugins } from './payload/plugins/index.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const allowedOrigins = [process.env.NEXT_PUBLIC_SERVER_URL].filter(Boolean);

function emailAdapter({ payload }: { payload: BasePayload }): {
  defaultFromAddress: string;
  defaultFromName: string;
  name: string;
  sendEmail: (message: any) => Promise<any>;
} {
  return {
    defaultFromAddress: 'no-reply@example.com',
    defaultFromName: 'Payload Demo',
    name: 'demo-email-adapter',
    sendEmail: async (message) => {
      // Implement actual email sending logic here
      console.log('Email would be sent:', message);
      return { message: 'Email sent successfully' };
    },
  };
}

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
    // collections: [
    //   {
    //     slug: 'posts',
    //     fields: [],
    //   },
    //   {
    //     slug: 'media',
    //     fields: [],
    //     upload: {
    //       staticDir: path.resolve(dirname, 'media'),
    //     },
    //   },
    // ],
    db: postgresAdapter({
      disableCreateDatabase: false,
      pool: { connectionString: process.env.DATABASE_URL },
      // Sync the demo schema in dev; production and migration commands use migrations.
      push: false,
      migrationDir: path.resolve(dirname, 'migrations'),
    }),
    email: emailAdapter,
    editor: lexicalEditor(),
    // onInit: async (payload) => {
    //   await seed(payload);
    // },
    plugins: [...plugins],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    // cors: allowedOrigins,
    // csrf: allowedOrigins,
    serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  });
};

export default buildConfigWithMemoryDB();
