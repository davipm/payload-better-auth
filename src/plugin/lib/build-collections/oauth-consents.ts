import type { CollectionConfig } from 'payload';
import type { OauthConsent } from '@/generated-types.js';
import type { BuildCollectionProps, FieldOverrides, FieldRule } from '@/plugin/types.js';
import { baModelKey } from '../../constants.js';
import { getAdminAccess } from '../../helpers/get-admin-access.js';
import { assertAllSchemaFields, getSchemaCollectionSlug } from './utils/collection-schema.js';
import { getCollectionFields } from './utils/transform-schema-fields-to-payload.js';

export function buildOauthConsentsCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const oauthConsentSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.oauthConsent);
  const oauthConsentSchema = resolvedSchemas[baModelKey.oauthConsent];

  const existingOauthConsentCollection = incomingCollections.find(
    (collection) => collection.slug === oauthConsentSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof OauthConsent> = {
    clientId: () => ({
      admin: {
        readOnly: true,
        description: 'OAuth client associated with the consent',
      },
    }),
    userId: () => ({
      admin: { readOnly: true, description: 'User associated with the consent' },
    }),
    scopes: () => ({
      admin: {
        readOnly: true,
        description: 'Comma-separated list of scopes consented to',
      },
    }),
  };

  const oauthConsentFieldRules: FieldRule[] = [
    {
      condition: (field) => field.fieldName === 'createdAt' || field.fieldName === 'updatedAt',
      transform: (field) => ({
        ...field,
        saveToJWT: false,
        admin: {
          disableBulkEdit: true,
          hidden: true,
        },
        index: true,
        label: ({ t }: any) =>
          field.fieldName === 'createdAt' ? t('general:createdAt') : t('general:updatedAt'),
      }),
    },
  ];

  const collectionFields = getCollectionFields({
    schema: oauthConsentSchema,
    fieldRules: oauthConsentFieldRules,
    additionalProperties: fieldOverrides,
  });

  let oauthConsentCollection: CollectionConfig = {
    ...existingOauthConsentCollection,
    slug: oauthConsentSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      description: 'OAuth consents are used to store user consents for OAuth clients',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingOauthConsentCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingOauthConsentCollection?.access ?? {}),
    },
    custom: {
      ...(existingOauthConsentCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.oauthConsent,
    },
    fields: [...(existingOauthConsentCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.oauthConsents === 'function') {
    oauthConsentCollection = pluginOptions.pluginCollectionOverrides.oauthConsents({
      collection: oauthConsentCollection,
    });
  }

  assertAllSchemaFields(oauthConsentCollection, oauthConsentSchema);

  return oauthConsentCollection;
}
