import type { AuthStrategy, AuthStrategyResult } from 'payload';
import { getPayloadAuth } from '@/plugin/index.js';
import { baseSlugs } from '../../../constants.js';

const STRATEGY_NAME = 'better-auth';
const ANONYMOUS: AuthStrategyResult = { user: null };

type AccessFlags = {
  banned?: boolean | null;
  banExpires?: string | number | Date | null;
  locked?: boolean | null;
};

const isBanActive = ({ banned, banExpires }: AccessFlags): boolean => {
  if (!banned) return false;
  if (!banExpires) return true; // permanent ban
  return new Date(banExpires).getTime() > Date.now();
};

/**
 * Auth strategy for BetterAuth.
 * @param userSlug - User collection slug (defaults to `baseSlugs.users`)
 */
export function betterAuthStrategy(userSlug: string = baseSlugs.users): AuthStrategy {
  return {
    name: STRATEGY_NAME,
    authenticate: async ({ payload, headers }) => {
      try {
        const payloadAuth = await getPayloadAuth(payload.config);

        // Read-only lookup: cookie writes from Server Actions (e.g. nextCookies())
        // invalidate the router cache and cause an infinite buildFormState loop in
        // the admin panel (issue #139). Refresh happens on real BA endpoints and the
        // plugin's refresh-token endpoint.
        const session = await payloadAuth.betterAuth.api.getSession({
          headers,
          query: { disableRefresh: true },
        });

        const userId = session?.session.userId;
        if (!userId) return ANONYMOUS;

        const user = await payloadAuth.findByID({
          collection: userSlug,
          id: userId,
          depth: 0,
          disableErrors: true, // return null instead of throwing NotFound
          overrideAccess: true, // auth lookup must not depend on collection read access
        });

        if (!user) return ANONYMOUS;

        // Reject banned/locked users even if their session is still valid
        if (isBanActive(user as AccessFlags) || (user as AccessFlags).locked) {
          return ANONYMOUS;
        }

        return {
          user: {
            ...user,
            collection: userSlug,
            _strategy: STRATEGY_NAME,
          },
        };
      } catch (error) {
        payload.logger.error({ err: error, msg: '[BetterAuth Strategy] Authentication error' });
        return ANONYMOUS;
      }
    },
  };
}
