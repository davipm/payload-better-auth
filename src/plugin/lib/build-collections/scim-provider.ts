import type { CollectionConfig } from 'payload';
import type { ScimProvider } from '@/generated-types.js';
import type { BuildCollectionProps, FieldOverrides } from '@/plugin/types.js';
import { baModelKey } from '../../constants.js';
import { getAdminAccess } from '../../helpers/get-admin-access.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from './utils/collection-schema.js';
// import { isAdminOrCurrentUserWithRoles } from './utils/payload-access.js';
import { getCollectionFields } from './utils/transform-schema-fields-to-payload.js';

export function buildScimProviderCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const scimProviderSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.scimProvider);
  const scimProviderSchema = resolvedSchemas[baModelKey.scimProvider];

  const existingScimProviderCollection = incomingCollections.find(
    (collection) => collection.slug === scimProviderSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof ScimProvider> = {
    providerId: () => ({
      admin: {
        readOnly: true,
        description: 'The provider ID. Used to identify a provider and to generate a redirect URL.',
      },
    }),
    scimToken: () => ({
      admin: {
        readOnly: true,
        description:
          'The SCIM bearer token. Used by your identity provider to authenticate against your server.',
      },
    }),
    organizationId: () => ({
      admin: {
        readOnly: true,
        description: 'The organization Id. If provider is linked to an organization.',
      },
    }),
  };

  const collectionFields = getCollectionFields({
    schema: scimProviderSchema,
    additionalProperties: fieldOverrides,
  });

  let scimProviderCollection: CollectionConfig = {
    ...existingScimProviderCollection,
    slug: scimProviderSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      useAsTitle: getSchemaFieldName(resolvedSchemas, baModelKey.scimProvider, 'providerId'),
      description: 'SCIM providers are used to authenticate users',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingScimProviderCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingScimProviderCollection?.access ?? {}),
    },
    custom: {
      ...(existingScimProviderCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.scimProvider,
    },
    fields: [...(existingScimProviderCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.scim === 'function') {
    scimProviderCollection = pluginOptions.pluginCollectionOverrides.scim({
      collection: scimProviderCollection,
    });
  }

  assertAllSchemaFields(scimProviderCollection, scimProviderSchema);

  return scimProviderCollection;
}
