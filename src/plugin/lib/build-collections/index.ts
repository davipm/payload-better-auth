import type { CollectionConfig } from 'payload';
import type { ModelKey } from '../../../generated-types.js';
import { baModelKey, baseSlugs } from '../../constants.js';
import type { BetterAuthSchemas, BuildCollectionProps, PayloadAuthOptions } from '../../types.js';
import { buildAccountsCollection } from './accounts/index.js';
import { buildAdminInvitationsCollection } from './admin-invitations/index.js';
import { buildApiKeysCollection } from './api-keys.js';
import { buildDeviceCodeCollection } from './device-code.js';
import { buildInvitationsCollection } from './invitations.js';
import { buildJwksCollection } from './jwks.js';
import { buildMembersCollection } from './members.js';
import { buildOauthAccessTokensCollection } from './oauth-access-tokens.js';
import { buildOauthApplicationsCollection } from './oauth-applications.js';
import { buildOauthConsentsCollection } from './oauth-consents.js';
import { buildOrganizationRolesCollection } from './organization-roles.js';
import { buildOrganizationsCollection } from './organizations.js';
import { buildPasskeysCollection } from './passkeys.js';
import { buildRateLimitCollection } from './rate-limit.js';
import { buildSessionsCollection } from './sessions.js';
import { buildSsoProvidersCollection } from './sso-providers.js';
import { buildSubscriptionsCollection } from './subscriptions.js';
import { buildTeamMembersCollection } from './team-members.js';
import { buildTeamsCollection } from './teams.js';
import { buildTwoFactorsCollection } from './two-factors.js';
import { buildUsersCollection } from './users/index.js';
import { getSchemaCollectionSlug } from './utils/collection-schema.js';
import { buildVerificationsCollection } from './verifications.js';

/**
 * Builds the required collections based on the BetterAuth options and plugins
 */
export function buildCollections({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: {
  incomingCollections: CollectionConfig[];
  pluginOptions: PayloadAuthOptions;
  resolvedSchemas: BetterAuthSchemas;
}): Record<string, CollectionConfig> {
  const collectionBuilders: Partial<
    Record<ModelKey, (props: BuildCollectionProps) => CollectionConfig>
  > = {
    [baModelKey.user]: (props: BuildCollectionProps) => buildUsersCollection(props),
    [baModelKey.account]: (props: BuildCollectionProps) => buildAccountsCollection(props),
    [baModelKey.session]: (props: BuildCollectionProps) => buildSessionsCollection(props),
    [baModelKey.verification]: (props: BuildCollectionProps) => buildVerificationsCollection(props),
    [baModelKey.organization]: (props: BuildCollectionProps) => buildOrganizationsCollection(props),
    [baModelKey.member]: (props: BuildCollectionProps) => buildMembersCollection(props),
    [baModelKey.invitation]: (props: BuildCollectionProps) => buildInvitationsCollection(props),
    [baModelKey.team]: (props: BuildCollectionProps) => buildTeamsCollection(props),
    [baModelKey.teamMember]: (props: BuildCollectionProps) => buildTeamMembersCollection(props),
    [baModelKey.jwks]: (props: BuildCollectionProps) => buildJwksCollection(props),
    [baModelKey.apikey]: (props: BuildCollectionProps) => buildApiKeysCollection(props),
    [baModelKey.twoFactor]: (props: BuildCollectionProps) => buildTwoFactorsCollection(props),
    [baModelKey.oauthAccessToken]: (props: BuildCollectionProps) =>
      buildOauthAccessTokensCollection(props),
    [baModelKey.oauthClient]: (props: BuildCollectionProps) =>
      buildOauthApplicationsCollection(props),
    [baModelKey.oauthConsent]: (props: BuildCollectionProps) => buildOauthConsentsCollection(props),
    [baModelKey.passkey]: (props: BuildCollectionProps) => buildPasskeysCollection(props),
    [baModelKey.ssoProvider]: (props: BuildCollectionProps) => buildSsoProvidersCollection(props),
    [baModelKey.subscription]: (props: BuildCollectionProps) => buildSubscriptionsCollection(props),
    [baModelKey.deviceCode]: (props: BuildCollectionProps) => buildDeviceCodeCollection(props),
    [baModelKey.rateLimit]: (props: BuildCollectionProps) => buildRateLimitCollection(props),
    [baModelKey.organizationRole]: (props: BuildCollectionProps) =>
      buildOrganizationRolesCollection(props),
  };

  const collectionMap: Record<string, CollectionConfig> = {};
  for (const modelKey of Object.keys(resolvedSchemas) as ModelKey[]) {
    const collectionSlug = getSchemaCollectionSlug(resolvedSchemas, modelKey);
    const builder = collectionBuilders[modelKey];
    if (!builder) continue;
    collectionMap[collectionSlug] = builder({
      incomingCollections,
      pluginOptions,
      resolvedSchemas,
    });
  }

  // Add adminInvitations collection as it's not in the collectionSchemaMap
  const adminInvitationsSlug = pluginOptions.adminInvitations?.slug ?? baseSlugs.adminInvitations;
  collectionMap[adminInvitationsSlug] = buildAdminInvitationsCollection({
    incomingCollections,
    pluginOptions,
  });

  // Then add incoming collections that don't conflict with required ones
  incomingCollections.forEach((c) => {
    if (!collectionMap[c.slug]) {
      collectionMap[c.slug] = c;
    }
  });

  return collectionMap;
}
