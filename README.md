# Payload Better Auth

`@davipm/payload-better-auth` connects [Better Auth](https://www.better-auth.com/) to [Payload CMS](https://payloadcms.com/). It uses Payload as Better Auth's database, creates Payload collections for the configured auth schema, and uses the same Better Auth session for your application and the Payload admin panel.

The plugin also supplies Payload admin login, signup, password reset, and two-factor views. You configure Better Auth as usual, except the plugin owns the `database` option and maps Better Auth models to Payload collections for you.

- Documentation: <https://payload-auth.dev>
- Full example configuration in this repository: [`dev/lib/auth.ts`](dev/lib/auth.ts)
- Payload adapter details: [`src/adapter/README.md`](src/adapter/README.md)

## Requirements

- Payload CMS 3.92.1 or later in the 3.x release line
- Better Auth 1.7.18 or later in the 1.x release line
- Next.js 16.4.5 and React 19.2.6, as required by the current package peer dependencies
- A Payload database adapter configured in your Payload app

Install the package and Better Auth in your Payload application:

```bash
pnpm add @davipm/payload-better-auth better-auth @better-auth/passkey
# or: npm install @davipm/payload-better-auth better-auth @better-auth/passkey
# or: bun add @davipm/payload-better-auth better-auth @better-auth/passkey
```

Install any additional Better Auth plugin packages that you use. For example, API keys are provided by separate packages:

```bash
pnpm add @better-auth/api-key
```

## 1. Set environment variables

Set these in your local environment and production deployment:

```dotenv
PAYLOAD_SECRET=replace-with-a-long-random-payload-secret
DATABASE_URL=your-payload-database-connection-string
BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

Generate a Better Auth secret with `openssl rand -base64 32`. Use HTTPS URLs in production, keep secrets server-side, and set `BETTER_AUTH_URL` and `NEXT_PUBLIC_SERVER_URL` to your deployed application origin. The auth endpoint uses `/api/auth` by default; set a matching Better Auth `basePath` and Next.js route if you change it.

`PAYLOAD_SECRET` and `DATABASE_URL` are standard Payload settings. The Better Auth secret and URL follow Better Auth's environment variable conventions. You can also set `secret` or `baseURL` in `betterAuthOptions`, but environment variables are usually easier to vary between deployments.

## 2. Add the plugin to Payload

Add the plugin to `plugins` in `payload.config.ts`. Set `admin.user` to the slug of the users collection the plugin creates or extends.

```ts
import { betterAuthPlugin } from '@davipm/payload-better-auth';
import { buildConfig } from 'payload';

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    // Your application collections go here.
  ],
  plugins: [
    betterAuthPlugin({
      users: {
        roles: ['user', 'admin'],
        adminRoles: ['admin'],
      },
      betterAuthOptions: {
        emailAndPassword: {
          enabled: true,
        },
      },
    }),
  ],
});
```

Email and password authentication is enabled by the plugin by default; including `emailAndPassword.enabled` makes that choice explicit. The plugin configures Better Auth's database adapter internally. Do not pass `betterAuthOptions.database`—it is intentionally excluded from the plugin's options type.

The plugin initializes Better Auth in Payload's `onInit` hook and attaches it to the Payload instance as `payload.betterAuth`. Your existing `onInit` callback is called before the plugin initializes Better Auth.

The plugin uses the Payload database adapter from your Payload config. For example, with PostgreSQL:

```ts
import { postgresAdapter } from '@payloadcms/db-postgres';

// Add to buildConfig({...})
db: postgresAdapter({
  pool: { connectionString: process.env.DATABASE_URL },
});
```

Install and configure the Payload database adapter that matches your database. The auth collections use that same database.

### Configure standard Better Auth options

Pass ordinary Better Auth settings through `betterAuthOptions`. This includes social providers, email callbacks, session settings, and Better Auth plugins. Configure callbacks to send email or OTP messages through your own delivery service.

```ts
import { admin, organization, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { betterAuthPlugin } from '@davipm/payload-better-auth';

betterAuthPlugin({
  users: {
    roles: ['user', 'admin'],
    adminRoles: ['admin'],
  },
  betterAuthOptions: {
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        // Send `url` to `user.email` using your email provider.
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Send `url` to `user.email` using your email provider.
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [
      admin(),
      twoFactor({ issuer: 'My application' }),
      passkey({
        rpID: process.env.PASSKEY_RP_ID!,
        rpName: 'My application',
        origin: process.env.BETTER_AUTH_URL!,
      }),
      organization(),
    ],
  },
});
```

Use the Better Auth documentation for each option's behavior and required settings. Plugin-specific collections are generated from the schemas returned by the Better Auth plugins. The package handles the model and relationship mappings for the supported Better Auth schema models. Some Better Auth plugins add models that this package does not currently map to Payload collections; check the [plugin reference](https://payload-auth.dev/docs/reference/better-auth-plugins) before enabling a schema-producing plugin.

### Match admin login methods to enabled providers

The Payload login and signup views infer methods from `socialProviders`, enabled email/password, and the passkey plugin. Set `admin.loginMethods` to control the displayed methods explicitly, including magic link.

```ts
betterAuthPlugin({
  admin: {
    loginMethods: ['emailPassword', 'google', 'passkey'],
  },
  // ...users and betterAuthOptions
});
```

The current Payload views render `emailPassword`, `magicLink`, `passkey`, and the supported social provider names such as `google`, `github`, and `apple`. `LoginMethod` also contains `emailOTP`, `phonePassword`, `phoneOTP`, and `phoneMagicLink`, but those methods are not rendered by the current Payload views. A displayed method must also be configured in Better Auth.

## 3. Mount Better Auth's Next.js handler

Create a catch-all route at `app/api/auth/[...all]/route.ts` (or the equivalent location under your `src` directory). It forwards Better Auth requests to the instance initialized by Payload.

```ts
import { toNextJsHandler } from 'better-auth/next-js';
import { getPayload } from '@/lib/payload';

const payload = await getPayload();

export const { GET, POST } = toNextJsHandler(payload.betterAuth);
```

For example, `getPayload` can provide a typed Payload instance:

```ts
// lib/payload.ts
import { getPayloadAuth } from '@davipm/payload-better-auth';
import config from '@payload-config';
import type { PayloadAuthConfig } from './auth';

export const getPayload = () => getPayloadAuth<PayloadAuthConfig>(config);
```

`getPayloadAuth` is a typed wrapper around Payload's `getPayload`. It throws a clear error if the plugin is missing or has not initialized. See [`dev/lib/payload.ts`](dev/lib/payload.ts) for the repository's example.

## 4. Use Better Auth from the application

Create a Better Auth client in your application and point it at the same origin and base path as the route above:

```ts
// lib/auth-client.ts
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
});
```

Use Better Auth's client methods in your forms or components:

```ts
await authClient.signIn.email({ email, password });

await authClient.signUp.email({
  name,
  email,
  password,
});

await authClient.signOut();
```

Add matching client plugins when the server uses Better Auth plugins that require them. For example, use `adminClient()` with the Better Auth admin plugin and `twoFactorClient()` with two-factor authentication. If you expose additional user fields such as `role` to the client, configure Better Auth's `inferAdditionalFields` client plugin using the server auth type. See [`dev/lib/auth-client.ts`](dev/lib/auth-client.ts) for a fuller client setup.

```ts
import { adminClient, inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
  plugins: [
    adminClient(),
    twoFactorClient(),
    inferAdditionalFields({ user: { role: { type: 'string' } } }),
  ],
});
```

## Use the Better Auth session with Payload

On the server, read the session with Better Auth's API:

```ts
import { headers } from 'next/headers';
import { getPayload } from '@/lib/payload';

const payload = await getPayload();
const session = await payload.betterAuth.api.getSession({
  headers: await headers(),
});
```

The generated Payload users collection also has a Better Auth strategy, so Payload's own auth API resolves the same session from request headers:

```ts
const { user } = await payload.auth({ headers: await headers() });
```

Pass the resolved user to Local API calls that should apply the user's Payload access rules. For example, omit `overrideAccess` or set it to `false` when querying content on behalf of the signed-in user.

## Payload admin panel

The plugin replaces Payload's built-in login flow with Better Auth views for login, signup, forgot password, reset password, and (when enabled) two-factor verification. Set `admin.user` to the plugin's user collection slug. The plugin disables Payload's local password strategy for that collection and installs a Better Auth strategy.

The plugin adds Better Auth fields to the configured user collection. If you already have a collection with the same slug, the plugin extends it with generated auth fields and retains its existing fields, hooks, and endpoints. The plugin also applies its own auth strategy and access rules. Existing access rules are merged last and can override the plugin's defaults, so review them carefully.

### Roles and user access

Configure the user roles in the plugin options:

```ts
users: {
  slug: 'users',            // Default: 'users'
  roles: ['user', 'admin', 'publisher'],
  adminRoles: ['admin'],
  defaultRole: 'user',
  defaultAdminRole: 'admin',
  allowedFields: ['name'],
}
```

- `roles` defines the selectable role values for users. Roles listed in `adminRoles` are included automatically.
- `adminRoles` identifies roles with admin access to the Better Auth collections generated by this plugin. If the Better Auth `admin()` plugin is enabled, the plugin also applies these roles to its `adminRoles` setting.
- `defaultRole` must be included in `roles` and is used for new users.
- `defaultAdminRole` is the default role for a new admin invitation.
- `allowedFields` controls which user fields a user may update through the generated collection access rule. Password changes are handled separately.

Defaults are `roles: ['user']`, `adminRoles: ['admin']`, `defaultRole: 'user'`, `defaultAdminRole: 'admin'`, and `allowedFields: ['name']`.

### Admin invitations and public signup

The plugin adds an `admin-invitations` collection by default and adds an invite control to the users collection in Payload. Configure `adminInvitations.sendInviteEmail` to deliver the generated invite URL. The default URL points to the Payload admin signup view with an invitation token. You can customize the collection slug, URL generator, email sender, or collection config with the `adminInvitations` options.

The Payload admin signup page always expects a valid invitation token. Public Better Auth signups through your app's auth API are a separate flow. To require an invitation for those public email and social signups too, enable `requireAdminInviteForSignUp`:

```ts
betterAuthPlugin({
  requireAdminInviteForSignUp: true,
  adminInvitations: {
    async sendInviteEmail({ email, url }) {
      await sendEmail({ to: email, url });
      return { success: true };
    },
  },
  // ...users and betterAuthOptions
});
```

With this option on, public email/password signups and social signups that request account creation must include a valid, unexpired invitation token. Existing users can still sign in. Admins can still create users through Payload or server-side code. Without it, public signup availability follows your Better Auth provider configuration; email/password is enabled by default, so disable it or add an appropriate signup policy if open registration is not intended.

For a public email signup, include the invitation token in Better Auth's request query:

```ts
await authClient.signUp.email({
  name,
  email,
  password,
  fetchOptions: {
    query: { adminInviteToken },
  },
});
```

## Generated collections and customization

The plugin creates Payload collections for the base Better Auth models (`users`, `accounts`, `sessions`, and `verifications`) and for schema models required by configured Better Auth plugins. It maps Better Auth model names and foreign-key fields to Payload collection slugs and relationships. The generated collections use Payload access rules; the default admin roles can manage auth records, and users can access their own account data according to the collection's rules.

Plugin-generated collections are visible in the Payload admin panel by default. Set `hidePluginCollections: true` to hide collections created for Better Auth plugins. The base collections have individual visibility options: `users.hidden`, `accounts.hidden`, `sessions.hidden`, `verifications.hidden`, and `adminInvitations.hidden`.

Collection slugs and configs can be customized. For example:

```ts
betterAuthPlugin({
  collectionAdminGroup: 'Authentication',
  users: {
    slug: 'members',
    roles: ['member', 'admin'],
    adminRoles: ['admin'],
    collectionOverrides: ({ collection }) => ({
      ...collection,
      admin: {
        ...collection.admin,
        defaultColumns: ['name', 'email', 'role'],
      },
    }),
  },
  sessions: { slug: 'auth-sessions', hidden: true },
  // ...betterAuthOptions
});
```

If you change `users.slug`, also set `admin.user` to the same slug. The plugin also provides collection overrides for `accounts`, `sessions`, `verifications`, `adminInvitations`, and supported Better Auth plugin collections through `pluginCollectionOverrides`. Keep the Better Auth schema and collection configuration in sync when overriding generated fields.

## Database schema and deployment

The Payload adapter stores Better Auth records in Payload collections. The plugin generates those collection configs from your Better Auth options and plugins; it does not use Better Auth's SQL migration CLI. When adding the plugin, changing Better Auth plugins, or changing schema fields, regenerate Payload types and create/apply Payload database migrations using your configured Payload adapter. For example:

```bash
pnpm exec payload generate:types
pnpm exec payload migrate:create
pnpm exec payload migrate
```

In local development, a database adapter configured to push schema changes can apply them automatically; use your normal migration workflow in production.

## Plugin options at a glance

| Option                                  | Purpose                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `betterAuthOptions`                     | Better Auth options except `database`, which is configured by the plugin                                                                    |
| `users`                                 | User collection slug, roles, allowed self-service fields, visibility, and overrides                                                         |
| `accounts`, `sessions`, `verifications` | Base collection slugs, visibility, and overrides                                                                                            |
| `adminInvitations`                      | Invite collection, invite URL generation, email delivery, and overrides                                                                     |
| `admin.loginMethods`                    | Explicitly controls methods shown in Payload's auth views                                                                                   |
| `requireAdminInviteForSignUp`           | Requires an invitation for public email and social signups                                                                                  |
| `hidePluginCollections`                 | Hides collections generated for Better Auth plugin schemas                                                                                  |
| `collectionAdminGroup`                  | Admin navigation group for generated auth collections; defaults to `Auth`                                                                   |
| `pluginCollectionOverrides`             | Overrides generated collection configs for supported Better Auth plugins                                                                    |
| `debug.enableDebugLogs`                 | Logs Payload adapter database operation inputs and results; use for development debugging because auth records may include sensitive values |
| `disabled`                              | Skips all plugin config changes when `true`                                                                                                 |

See the [`PayloadAuthOptions` type](src/plugin/types.ts) and the [plugin options reference](https://payload-auth.dev/docs/reference/plugin-options) for the complete option list.

## Package exports

```ts
import { betterAuthPlugin, getPayloadAuth } from '@davipm/payload-better-auth';
import {/* client components */} from '@davipm/payload-better-auth/client';
import {/* server components */} from '@davipm/payload-better-auth/rsc';
```

The main entry exports `betterAuthPlugin`, `getPayloadAuth`, the plugin option types, and adapter utilities. `/client` and `/rsc` expose the components used by the Payload admin integration. Most applications only need the main entry and the Better Auth client package.

## Troubleshooting

- **Better Auth reports that the database model is missing:** Confirm `betterAuthPlugin` is in the Payload config's `plugins` array and that your Payload database is configured. The plugin supplies the database adapter and generated collection mappings.
- **The admin panel does not use Better Auth:** Confirm `admin.user` matches `users.slug` and that the plugin is enabled.
- **An auth collection is missing:** Enable the Better Auth plugin that defines the schema model, confirm its required package is installed, and check the plugin compatibility reference.
- **Social login does not appear:** Add the provider to `betterAuthOptions.socialProviders`, set its credentials, and check `admin.loginMethods` if you set it explicitly.
- **Email reset or verification messages are not delivered:** Configure the relevant Better Auth callback (`sendResetPassword` or `sendVerificationEmail`) to use your email provider.
- **Payload reports an access denial for auth data:** Check `users.adminRoles` and your existing collection access config. Existing collection access rules are merged after the plugin's default rules.
- **Admin invite links use the wrong host:** Set `serverURL` in Payload config and configure `adminInvitations.generateInviteUrl` if you need a custom URL format.

## More information

- [Plugin options](https://payload-auth.dev/docs/reference/plugin-options)
- [Generated collections](https://payload-auth.dev/docs/concepts/collections)
- [Payload admin integration](https://payload-auth.dev/docs/concepts/admin-panel)
- [Supported Better Auth plugins](https://payload-auth.dev/docs/reference/better-auth-plugins)
- [Better Auth documentation](https://www.better-auth.com/docs)
- [Payload plugin documentation](https://payloadcms.com/docs/plugins/overview)
