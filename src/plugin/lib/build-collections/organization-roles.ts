import type { CollectionConfig } from 'payload';
import type { OrganizationRole } from '../../../types/generated-types.js';
import type { BuildCollectionProps, FieldOverrides } from '../../../types/plugin.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { getCollectionFields } from '../../../utils/plugin/build-collections/transform-schema-fields-to-payload.js';
import { getAdminAccess } from '../../../utils/plugin/get-admin-access.js';
import { baModelKey } from '../../constants.js';

export function buildOrganizationRolesCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const organizationRolesSlug = getSchemaCollectionSlug(
    resolvedSchemas,
    baModelKey.organizationRole,
  );
  const organizationRolesSchema = resolvedSchemas[baModelKey.organizationRole];

  const existingOrganizationRolesCollection = incomingCollections.find(
    (collection) => collection.slug === organizationRolesSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof OrganizationRole> = {
    organizationId: () => ({
      index: true,
      admin: { readOnly: true, description: 'The ID of the organization' },
    }),
    role: () => ({
      admin: { description: 'The name of the role' },
    }),
    permission: () => ({
      index: true,
      admin: { description: 'The permission of the organization role' },
    }),
  };

  const collectionFields = getCollectionFields({
    schema: organizationRolesSchema,
    additionalProperties: fieldOverrides,
  });

  const titleFieldKey = ['role', 'name', 'title', 'label', 'permission'].find(
    (key) => organizationRolesSchema.fields[key],
  );
  const firstSchemaField = Object.entries(organizationRolesSchema.fields)[0];
  const titleField = titleFieldKey
    ? (organizationRolesSchema.fields[titleFieldKey].fieldName ?? titleFieldKey)
    : (firstSchemaField?.[1].fieldName ?? firstSchemaField?.[0] ?? 'id');

  let organizationRolesCollection: CollectionConfig = {
    ...existingOrganizationRolesCollection,
    slug: organizationRolesSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      description: 'Organization roles are the roles that are available for an organization.',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingOrganizationRolesCollection?.admin,
      useAsTitle: titleField,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingOrganizationRolesCollection?.access ?? {}),
    },
    custom: {
      ...(existingOrganizationRolesCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.organizationRole,
    },
    fields: [...(existingOrganizationRolesCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.organizationRoles === 'function') {
    organizationRolesCollection = pluginOptions.pluginCollectionOverrides.organizationRoles({
      collection: organizationRolesCollection,
    });
  }

  assertAllSchemaFields(organizationRolesCollection, organizationRolesSchema);

  return organizationRolesCollection;
}
