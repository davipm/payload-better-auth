import { passkey } from '@better-auth/passkey';
import { nextCookies } from 'better-auth/next-js';
import {
  admin,
  anonymous,
  emailOTP,
  magicLink,
  multiSession,
  openAPI,
  organization,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import type { BetterAuthPlugin as BetterAuthPluginType } from 'better-auth/types';
import { emailHarmony, phoneHarmony } from 'better-auth-harmony';
import type { CollectionConfig } from 'payload';
import type { BetterAuthOptions, PayloadAuthOptions } from '@/plugin/index.js';
import { hiddenUnlessAdmin } from '../utils/auth.js';

export const betterAuthPlugins = [
  username(),
  emailHarmony(),
  phoneHarmony({ defaultCountry: 'JP' }),
  twoFactor({
    issuer: 'payload-better-auth',
    otpOptions: {
      async sendOTP({ user, otp }) {
        console.log('Send OTP for user: ', user, otp);
      },
    },
  }),
  anonymous({
    emailDomainName: 'payload-better-auth.com',
    disableDeleteAnonymousUser: false,
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      console.log('Link account for anonymous user: ', anonymousUser, newUser);
    },
  }),
  phoneNumber({
    sendOTP: async ({ phoneNumber, code }, req) => {
      console.log('Send OTP for user: ', phoneNumber, code, req);
    },
  }),
  magicLink({
    sendMagicLink: async ({ email, token, url }, request) => {
      console.log('Send magic link for user: ', email, token, url, request);
    },
  }),
  emailOTP({
    async sendVerificationOTP({ email, otp, type }) {
      console.log('Send verification OTP for user: ', email, otp, type);
    },
  }),
  passkey({
    rpID: 'localhost',
    rpName: 'Localhost',
    origin: 'http://localhost:3000',
  }),
  admin(),
  // apiKey(),
  organization({
    teams: {
      enabled: true,
    },
    async sendInvitationEmail(data) {
      const inviteLink = `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/accept-invitation/${data.id}`;
      console.log('Send invite for org: ', data, inviteLink);
    },
  }),
  multiSession(),
  openAPI(),
  nextCookies(),
] satisfies BetterAuthPluginType[];

// export type BetterAuthPlugins = typeof betterAuthPlugins;

export const betterAuthOptions = {
  appName: 'payload-better-auth',
  baseURL: 'http://localhost:3000',
  trustedOrigins: ['http://localhost:3000'],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      console.log('Send reset password for user: ', user.id, 'at url', url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ url, user }) => {
      console.log('Send verification email for user: ', url, user);
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) => {
        console.log('Send change email verification for user: ', user, newEmail, url, token);
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        console.log({ user, url, token });
        // Send delete account verification
      },
      beforeDelete: async (user) => {
        console.log({ user });
        // Perform actions before user deletion
      },
      afterDelete: async (user) => {
        console.log({ user });
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
  plugins: betterAuthPlugins,
} satisfies BetterAuthOptions;

// export type ConstructedBetterAuthOptions = typeof betterAuthOptions;

export const payloadAuthOptions = {
  betterAuthOptions,
  disabled: false,
  debug: {
    logTables: false,
    enableDebugLogs: false,
  },
  // admin: {
  //   loginMethods: ['passkey']
  // },
  hidePluginCollections: true,
  users: {
    slug: 'users', // not required, this is the default anyway
    hidden: false,
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin', 'publisher'] as const,
    allowedFields: ['name'],
    collectionOverrides: ({ collection }): CollectionConfig => ({
      ...collection,
      admin: {
        ...collection.admin,
        hidden: hiddenUnlessAdmin(),
      },
    }),
  },
  accounts: {
    slug: 'accounts',
  },
  sessions: {
    slug: 'sessions',
  },
  verifications: {
    slug: 'verifications',
  },
  adminInvitations: {
    sendInviteEmail: async ({ payload, email, url }) => {
      console.log('Send admin invite: ', email, url, payload);
      return { success: true };
    },
  },
} satisfies PayloadAuthOptions;

export type PayloadAuthConfig = typeof payloadAuthOptions;
