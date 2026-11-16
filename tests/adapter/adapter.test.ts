import { betterAuth } from 'better-auth';
import type { TestHelpers } from 'better-auth/plugins';
import type { BasePayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { payloadAdapter } from '../../src';
import { getPayload } from '../dev';
import {
  runBaseCollectionsNumberIdTests,
  runBaseCollectionsTests,
} from './base-collections-tests.js';

describe('Handle Payload Adapter', () => {
  it('should successfully add the Payload Adapter', async () => {
    const payload = await getPayload();

    const auth = betterAuth({
      baseURL: 'http://localhost:3000',
      database: payloadAdapter({
        payloadClient: payload,
        adapterConfig: {
          idType: 'number',
        },
      }),
    });

    expect(auth).toBeDefined();
    expect(auth.options.database).toBeDefined();
    expect(auth.options.database({}).id).toEqual('payload-adapter');
  });
});

function deleteAll(getPayload: () => Promise<BasePayload>) {
  beforeAll(async () => {
    const payload = await getPayload();
    await payload.delete({
      collection: 'users',
      where: {
        id: {
          exists: true,
        },
      },
    });

    await payload.delete({
      collection: 'sessions',
      where: {
        id: {
          exists: true,
        },
      },
    });

    await payload.delete({
      collection: 'accounts',
      where: {
        id: {
          exists: true,
        },
      },
    });

    await payload.delete({
      collection: 'verifications',
      where: {
        id: {
          exists: true,
        },
      },
    });
  });
  afterAll(async () => {
    const payload = await getPayload();
    await payload.delete({
      collection: 'sessions',
      where: {
        id: {
          exists: true,
        },
      },
    });

    await payload.delete({
      collection: 'accounts',
      where: {
        id: {
          exists: true,
        },
      },
    });
    await payload.delete({
      collection: 'users',
      where: {
        id: {
          exists: true,
        },
      },
    });

    await payload.delete({
      collection: 'verifications',
      where: {
        id: {
          exists: true,
        },
      },
    });
  });
}

describe('Run BetterAuth Base Collections Adapter tests', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>;

  beforeAll(async () => {
    payload = await getPayload();
  });
  deleteAll(async () => payload);

  runBaseCollectionsTests({
    getAdapter: async (
      customOptions = {
        ...payload.betterAuth.options,
      },
    ) => {
      const adapter = payloadAdapter({
        payloadClient: payload,
        adapterConfig: { idType: 'number' },
      });
      return adapter({ ...customOptions });
    },
    disableTests: {
      SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
    },
  });
});

describe('Run BetterAuth Base Collections Adapter tests with number id', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>;

  beforeAll(async () => {
    payload = await getPayload();
  });
  deleteAll(async () => payload);

  runBaseCollectionsNumberIdTests(
    {
      getAdapter: async (
        customOptions = {
          ...payload.betterAuth.options,
          advanced: {
            database: {
              generateId: 'serial',
            },
          },
        },
      ) => {
        const adapter = payloadAdapter({
          payloadClient: payload,
          adapterConfig: { idType: 'number' },
        });
        return adapter({ ...customOptions });
      },
      disableTests: {
        SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
      },
    },
    {
      predefinedOptions: {
        ...payload.betterAuth.options,
        advanced: {
          database: {
            generateId: 'serial',
          },
        },
      },
    },
  );
});

describe('Authentication Flow Tests', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>;
  let test: TestHelpers;

  beforeAll(async () => {
    payload = await getPayload();
    const ctx = (await payload.betterAuth.$context) as unknown as {
      test: TestHelpers;
    };
    test = ctx.test;
  });

  deleteAll(async () => payload);

  it('should successfully sign up a new user via API', async () => {
    const user = await payload.betterAuth.api.signUpEmail({
      body: {
        email: 'test-email@email.com',
        password: 'password12345',
        name: 'Test Name',
      },
    });
    expect(user).toBeDefined();
  });

  it('should create a user via test helpers and get an authenticated session', async () => {
    const user = test.createUser({
      email: 'helper-user@email.com',
      name: 'Helper User',
      emailVerified: true,
    });
    const savedUser = await test.saveUser(user);
    expect(savedUser.id).toBeDefined();
    expect(savedUser.email).toBe('helper-user@email.com');

    const {
      session,
      user: sessionUser,
      headers,
      token,
    } = await test.login({
      userId: savedUser.id,
    });
    expect(session).toBeDefined();
    expect(session.userId).toBe(savedUser.id);
    expect(token).toBe(session.token);
    expect(sessionUser.email).toBe('helper-user@email.com');
    expect(headers.get('cookie')).toContain('better-auth.session_token=');

    // Verify session persisted in Payload DB
    const dbSessions = await payload.find({
      collection: 'sessions',
      where: { token: { equals: session.token } },
    });
    expect(dbSessions.docs).toHaveLength(1);

    await test.deleteUser(savedUser.id);
  });

  it('should get auth headers for a user', async () => {
    const user = test.createUser({
      email: 'headers-user@email.com',
      name: 'Headers User',
      emailVerified: true,
    });
    const savedUser = await test.saveUser(user);

    const headers = await test.getAuthHeaders({ userId: savedUser.id });
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get('cookie')).toContain('better-auth.session_token=');

    // Verify user persisted in Payload DB
    const dbUser = await payload.findByID({
      collection: 'users',
      id: savedUser.id,
    });
    expect(dbUser.email).toBe('headers-user@email.com');

    await test.deleteUser(savedUser.id);
  });
});
