import type { CollectionConfig } from 'payload';
import type { OauthAccessToken } from '../../../types/generated-types.js';
import type { BuildCollectionProps, FieldOverrides, FieldRule } from '../../../types/plugin.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { getCollectionFields } from '../../../utils/plugin/build-collections/transform-schema-fields-to-payload.js';
import { getAdminAccess } from '../../../utils/plugin/get-admin-access.js';
import { baModelKey } from '../../constants.js';

export function buildOauthAccessTokensCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const oauthAccessTokenSlug = getSchemaCollectionSlug(
    resolvedSchemas,
    baModelKey.oauthAccessToken,
  );
  const oauthAccessTokenSchema = resolvedSchemas[baModelKey.oauthAccessToken];

  const existingOauthAccessTokenCollection = incomingCollections.find(
    (collection) => collection.slug === oauthAccessTokenSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof OauthAccessToken> = {
    token: () => ({
      index: true,
      admin: {
        readOnly: true,
        description: 'Access token issued to the client',
      },
    }),
    clientId: () => ({
      admin: {
        readOnly: true,
        description: 'OAuth application associated with the access token',
      },
    }),
    userId: () => ({
      admin: {
        readOnly: true,
        description: 'User associated with the access token',
      },
    }),
    scopes: () => ({
      admin: { description: 'Comma-separated list of scopes granted' },
    }),
  };

  const oauthAccessTokenFieldRules: FieldRule[] = [
    {
      condition: (field) => field.fieldName === 'createdAt' || field.fieldName === 'updatedAt',
      transform: (field) => ({
        ...field,
        saveToJWT: false,
        admin: {
          disabled: { bulkEdit: true },
          hidden: true,
        },
        index: true,
        label: ({ t }: any) =>
          field.fieldName === 'createdAt' ? t('general:createdAt') : t('general:updatedAt'),
      }),
    },
  ];

  const collectionFields = getCollectionFields({
    schema: oauthAccessTokenSchema,
    fieldRules: oauthAccessTokenFieldRules,
    additionalProperties: fieldOverrides,
  });

  let oauthAccessTokenCollection: CollectionConfig = {
    ...existingOauthAccessTokenCollection,
    slug: oauthAccessTokenSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      useAsTitle: getSchemaFieldName(resolvedSchemas, baModelKey.oauthAccessToken, 'token'),
      description: 'OAuth access tokens for custom OAuth clients',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingOauthAccessTokenCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingOauthAccessTokenCollection?.access ?? {}),
    },
    custom: {
      ...(existingOauthAccessTokenCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.oauthAccessToken,
    },
    fields: [...(existingOauthAccessTokenCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.oauthAccessTokens === 'function') {
    oauthAccessTokenCollection = pluginOptions.pluginCollectionOverrides.oauthAccessTokens({
      collection: oauthAccessTokenCollection,
    });
  }

  assertAllSchemaFields(oauthAccessTokenCollection, oauthAccessTokenSchema);

  return oauthAccessTokenCollection;
}
