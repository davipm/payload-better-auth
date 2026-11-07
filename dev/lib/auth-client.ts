import { adminClient, inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
  plugins: [
    adminClient(),
    twoFactorClient(),
    inferAdditionalFields({ user: { role: { type: 'string' } } }),
  ],
});
