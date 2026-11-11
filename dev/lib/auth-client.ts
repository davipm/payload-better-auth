import { passkeyClient } from '@better-auth/passkey/client';
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
  magicLinkClient,
  multiSessionClient,
  organizationClient,
  phoneNumberClient,
  twoFactorClient,
  usernameClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/two-factor';
      },
    }),
    usernameClient(),
    anonymousClient(),
    phoneNumberClient(),
    magicLinkClient(),
    emailOTPClient(),
    passkeyClient(),
    adminClient(),
    organizationClient(),
    multiSessionClient(),
    inferAdditionalFields({ user: { role: { type: 'string' } } }),
  ],
  fetchOptions: {
    onError: (e) => {
      if (e.error.status === 429) {
        console.error('Too many requests. Please try again later.');
      }
    },
  },
});
