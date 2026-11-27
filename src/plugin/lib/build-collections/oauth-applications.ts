import type { CollectionConfig } from 'payload';
import type { OauthClient } from '../../../types/generated-types.js';
import type { BuildCollectionProps, FieldOverrides, FieldRule } from '../../../types/plugin.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { getCollectionFields } from '../../../utils/plugin/build-collections/transform-schema-fields-to-payload.js';
import { getAdminAccess } from '../../../utils/plugin/get-admin-access.js';
import { baModelKey } from '../../constants.js';

export function buildOauthApplicationsCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const oauthApplicationSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.oauthClient);

  const oauthApplicationSchema = resolvedSchemas[baModelKey.oauthClient];

  const existingOauthApplicationCollection = incomingCollections.find(
    (collection) => collection.slug === oauthApplicationSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof OauthClient> = {
    clientId: () => ({
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Unique identifier for each OAuth client',
      },
    }),
    clientSecret: () => ({
      admin: { readOnly: true, description: 'Secret key for the OAuth client' },
    }),
    name: () => ({
      index: true,
      admin: { description: 'Name of the OAuth application' },
    }),
    redirectUris: () => ({
      admin: { description: 'Redirect URIs allowed for this OAuth client' },
    }),
    metadata: () => ({
      admin: {
        readOnly: true,
        description: 'Additional metadata for the OAuth application',
      },
    }),
    applicationType: () => ({
      admin: {
        readOnly: true,
        description: 'Type of OAuth client (e.g., web, mobile)',
      },
    }),
    disabled: () => ({
      defaultValue: false,
      admin: { description: 'Indicates if the client is disabled' },
    }),
    icon: () => ({
      admin: { description: 'Icon of the OAuth application' },
    }),
    userId: () => ({
      admin: {
        readOnly: true,
        description: 'ID of the user who owns the client. (optional)',
      },
    }),
  };

  const oauthApplicationFieldRules: FieldRule[] = [
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
    schema: oauthApplicationSchema,
    fieldRules: oauthApplicationFieldRules,
    additionalProperties: fieldOverrides,
  });

  let oauthApplicationCollection: CollectionConfig = {
    ...existingOauthApplicationCollection,
    slug: oauthApplicationSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      useAsTitle: oauthApplicationSchema?.fields?.name?.fieldName,
      description: 'OAuth applications are custom OAuth clients',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingOauthApplicationCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingOauthApplicationCollection?.access ?? {}),
    },
    custom: {
      ...(existingOauthApplicationCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.oauthClient,
    },
    fields: [...(existingOauthApplicationCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.oauthApplications === 'function') {
    oauthApplicationCollection = pluginOptions.pluginCollectionOverrides.oauthApplications({
      collection: oauthApplicationCollection,
    });
  }

  assertAllSchemaFields(oauthApplicationCollection, oauthApplicationSchema);

  return oauthApplicationCollection;
}
