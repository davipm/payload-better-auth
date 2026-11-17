import { postgresAdapter } from '@payloadcms/db-postgres';
import dotenv from 'dotenv';
import { buildConfig, type Payload } from 'payload';

dotenv.config({ path: new URL('./.env', import.meta.url).pathname });

import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
// import { nextCookies } from 'better-auth/next-js';
import {
  admin,
  anonymous,
  createAccessControl,
  emailOTP,
  lastLoginMethod,
  magicLink,
  multiSession,
  // openAPI,
  organization,
  phoneNumber,
  testUtils,
  twoFactor,
  username,
} from 'better-auth/plugins';
import {
  defaultRoles as defaultAdminRoles,
  defaultStatements as defaultAdminStatements,
} from 'better-auth/plugins/admin/access';
import {
  defaultRoles as defaultOrganizationRoles,
  defaultStatements as defaultOrganizationStatements,
  ownerAc,
} from 'better-auth/plugins/organization/access';
import type { BetterAuthOptions } from 'better-auth/types';
import { phoneHarmony } from 'better-auth-harmony';
import {
  type BetterAuthReturn,
  // type BetterAuthOptions,
  betterAuthPlugin,
  getPayloadAuth,
  type PayloadAuthOptions,
} from '../../src/plugin/index.js';

const statement = {
  ...defaultOrganizationStatements,
  project: ['create', 'share', 'update', 'delete'],
} as const;

const adminStatement = {
  ...defaultAdminStatements,
  project: ['create', 'share', 'update', 'delete'],
} as const;

const adminAc = createAccessControl(adminStatement);

const adminSuperAdmin = adminAc.newRole({
  ...adminAc.statements,
});

const ac = createAccessControl(statement);

const superAdmin = ac.newRole({
  project: ['create', 'update'],
  ...ownerAc.statements,
});

let payloadLogger: Payload['logger'] | undefined;

function logTestAuth(msg: string, data: Record<string, unknown> = {}) {
  payloadLogger?.info({ ...data, msg: `[test-auth] ${msg}` });
}

export const betterAuthOptions = {
  appName: 'payload-better-auth',
  baseURL: 'http://localhost:3000' as const,
  trustedOrigins: ['http://localhost:3000'],
  plugins: [
    admin({
      ac: adminAc,
      roles: {
        ...defaultAdminRoles,
        adminSuperAdmin,
      },
      defaultRole: 'user',
    }),
    username(),
    organization({
      ac,
      roles: {
        ...defaultOrganizationRoles,
        superAdmin,
      },
      teams: {
        enabled: true,
      },
      dynamicAccessControl: {
        enabled: true,
      },
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/accept-invitation/${data.id}`;
        logTestAuth('Organization invitation generated', {
          email: data.email,
          organizationId: data.organization.id,
          inviteLink,
        });
      },
    }),
    lastLoginMethod({ storeInDatabase: true }),
    twoFactor({
      issuer: 'payload-better-auth',
      otpOptions: {
        async sendOTP({ user, otp }) {
          logTestAuth('Two-factor code generated', { email: user.email, otp });
        },
      },
    }),
    // emailHarmony is intentionally excluded from test config because it
    // uses mail checker to reject disposable/test email domains (@test.com,
    // @example.com, @email.com) which breaks test signups.
    phoneHarmony({
      defaultCountry: 'CA',
    }),
    anonymous({
      emailDomainName: 'payload-better-auth.com',
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        logTestAuth('Anonymous account linked', {
          anonymousUserId: anonymousUser.id,
          userId: newUser.id,
        });
      },
      disableDeleteAnonymousUser: false,
    }),
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        logTestAuth('Phone verification code generated', { phoneNumber, code });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        logTestAuth('Magic link generated', { email, url });
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        logTestAuth('Email verification code generated', { email, otp, type });
      },
    }),
    passkey({
      rpID: 'localhost',
      rpName: 'Localhost',
      origin: 'http://localhost:3000',
    }),
    apiKey(),
    multiSession(),
    testUtils({ captureOTP: true }),
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'test-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret',
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      logTestAuth('Email verification link generated', { userId: user.id, email: user.email, url });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) => {
        logTestAuth('Change email verification link generated', {
          userId: user.id,
          email: user.email,
          newEmail,
          url,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        // Send delete account verification
      },
      beforeDelete: async (_user) => {
        // Perform actions before user deletion
      },
      afterDelete: async (_user) => {
        // Perform cleanup after user deletion
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'email-password'],
    },
  },
} satisfies BetterAuthOptions;

export const betterAuthPluginOptions = {
  disabled: false,
  debug: {
    logTables: false,
    enableDebugLogs: false,
  },
  hidePluginCollections: true,
  users: {
    roles: ['user', 'admin', 'adminSuperAdmin'] as const,
    hidden: false,
    adminRoles: ['admin'],
    allowedFields: ['name'],
  },
  adminInvitations: {
    sendInviteEmail: async ({
      payload,
      email,
      url,
    }: {
      payload: Payload;
      email: string;
      url: string;
    }) => {
      payload.logger.info({ email, url, msg: '[test-auth] Admin invitation generated' });
      return {
        success: true as const,
      };
    },
  },
  betterAuthOptions: betterAuthOptions,
} satisfies PayloadAuthOptions;

type PayloadAuthOptionsType = typeof betterAuthPluginOptions;

const emailAdapter = () => {
  return () => ({
    name: 'dev',
    defaultFromAddress: 'test@performix.ca',
    defaultFromName: 'Test',
    sendEmail: async (message: { to: any; subject: any }) => {
      logTestAuth('Email queued', { to: message.to, subject: message.subject });
    },
  });
};

export const payloadConfig = buildConfig({
  admin: {
    user: 'users',
  },
  serverURL: 'http://localhost:3000',
  secret: 'super-secret-payload-key',
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/auth-test',
    },
    migrationDir: decodeURIComponent(new URL('./migrations', import.meta.url).pathname),
    transactionOptions: false,
    push: false,
  }),
  email: emailAdapter(),
  telemetry: false,
  plugins: [betterAuthPlugin(betterAuthPluginOptions)],
  typescript: {
    outputFile: decodeURIComponent(new URL('./payload-types.ts', import.meta.url).pathname),
  },
});

export async function getPayload() {
  const payload = await getPayloadAuth<PayloadAuthOptionsType>(payloadConfig);
  payloadLogger = payload.logger;
  return payload;
}

export type Errors = BetterAuthReturn<PayloadAuthOptionsType>['$ERROR_CODES'];

export type Session = BetterAuthReturn<PayloadAuthOptionsType>['$Infer']['Session']['user'];

export type User = BetterAuthReturn<PayloadAuthOptionsType>['$Infer']['Session']['user']['role'];

export type Organization = BetterAuthReturn<PayloadAuthOptionsType>['$Infer']['Organization'];

export type Member = BetterAuthReturn<PayloadAuthOptionsType>['$Infer']['Member'];

export type Invitation = BetterAuthReturn<PayloadAuthOptionsType>['$Infer']['Invitation'];

export default payloadConfig;
