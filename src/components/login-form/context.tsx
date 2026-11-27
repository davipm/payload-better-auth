// login-form/provider.tsx
'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { magicLinkClient, twoFactorClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { adminRoutes } from '../../plugin/constants.js';
import type { LoginMethod } from '../../types/plugin.js';

export type LoginIdentifier = 'email' | 'username';
export type LoginType = 'email' | 'username' | 'emailOrUsername';

export interface Prefill {
  email?: string;
  password?: string;
  username?: string;
}

export interface LoginPlugins {
  username?: boolean;
  passkey?: boolean;
  magicLink?: boolean;
}

// Typed against the full plugin set. The runtime client only includes the enabled ones.
type FullClientOptions = {
  plugins: [
    ReturnType<typeof usernameClient>,
    ReturnType<typeof twoFactorClient>,
    ReturnType<typeof passkeyClient>,
    ReturnType<typeof magicLinkClient>,
  ];
};

export type LoginAuthClient = ReturnType<typeof createAuthClient<FullClientOptions>>;

interface LoginFormContextValue {
  loginMethods: LoginMethod[];
  email: string;
  setEmail: (email: string) => void;
  redirectUrl: string;
  isSignup: boolean;
  authClient: LoginAuthClient;
  loginType: LoginType;
  hasMethod: (method: LoginMethod) => boolean;
  alternativeMethods: LoginMethod[];
  showIconOnly: boolean;
  adminInviteToken?: string;
  newUserCallbackURL?: string;
  prefill: Prefill;
}

const LoginFormContext = createContext<LoginFormContextValue | null>(null);

// Stable fallback so `prefill` never changes identity between renders
const EMPTY_PREFILL: Prefill = {};

export interface LoginFormProviderProps {
  children: ReactNode;
  loginMethods: LoginMethod[];
  redirectUrl: string;
  adminRoute: string;
  baseURL?: string;
  basePath?: string;
  isSignup?: boolean;
  loginIdentifiers: LoginIdentifier[];
  plugins?: LoginPlugins;
  prefill?: Prefill;
  adminInviteToken?: string;
  newUserCallbackURL?: string;
}

export function LoginFormProvider({
  children,
  loginMethods,
  redirectUrl,
  adminRoute,
  baseURL,
  basePath,
  isSignup = false,
  loginIdentifiers,
  plugins,
  prefill = EMPTY_PREFILL,
  adminInviteToken,
  newUserCallbackURL,
}: LoginFormProviderProps) {
  const {
    username: hasUsernamePlugin = false,
    passkey: hasPasskeyPlugin = false,
    magicLink: hasMagicLinkPlugin = false,
  } = plugins ?? {};

  const router = useRouter();
  const [email, setEmail] = useState(prefill.email ?? '');

  // Primitive flag instead of depending on the `loginMethods` array identity,
  // so a new array reference doesn't rebuild the client
  const needsMagicLink = hasMagicLinkPlugin || loginMethods.includes('magicLink');

  const authClient = useMemo(
    () =>
      createAuthClient({
        baseURL,
        basePath,
        plugins: [
          usernameClient(),
          twoFactorClient({
            onTwoFactorRedirect() {
              router.push(
                `${adminRoute}${adminRoutes.twoFactorVerify}?redirect=${encodeURIComponent(redirectUrl)}`,
              );
            },
          }),
          ...(hasPasskeyPlugin ? [passkeyClient()] : []),
          ...(needsMagicLink ? [magicLinkClient()] : []),
        ],
      }) as unknown as LoginAuthClient,
    [adminRoute, baseURL, basePath, hasPasskeyPlugin, needsMagicLink, redirectUrl, router],
  );

  const canUseUsername = hasUsernamePlugin && loginIdentifiers.includes('username');
  const loginType: LoginType = canUseUsername
    ? loginIdentifiers.includes('email')
      ? 'emailOrUsername'
      : 'username'
    : 'email';

  const hasMethod = useCallback(
    (method: LoginMethod) => loginMethods.includes(method),
    [loginMethods],
  );

  const alternativeMethods = useMemo(
    () =>
      loginMethods.filter((m) => {
        if (m === 'emailPassword') return false;
        return !(isSignup && (m === 'passkey' || m === 'magicLink'));
      }),
    [loginMethods, isSignup],
  );
  const showIconOnly = alternativeMethods.length >= 3;

  const value = useMemo<LoginFormContextValue>(
    () => ({
      loginMethods,
      email,
      setEmail,
      redirectUrl,
      isSignup,
      authClient,
      loginType,
      hasMethod,
      alternativeMethods,
      showIconOnly,
      adminInviteToken,
      newUserCallbackURL,
      prefill,
    }),
    [
      loginMethods,
      email,
      redirectUrl,
      isSignup,
      authClient,
      loginType,
      hasMethod,
      alternativeMethods,
      showIconOnly,
      adminInviteToken,
      newUserCallbackURL,
      prefill,
    ],
  );

  return <LoginFormContext.Provider value={value}>{children}</LoginFormContext.Provider>;
}

export const useLoginForm = () => {
  const context = useContext(LoginFormContext);
  if (!context) throw new Error('useLoginForm must be used within a LoginFormProvider');
  return context;
};
