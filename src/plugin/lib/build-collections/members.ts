import type { CollectionConfig } from 'payload';
import type { Member } from '../../../types/generated-types.js';
import type { BuildCollectionProps, FieldOverrides } from '../../../types/plugin.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { getCollectionFields } from '../../../utils/plugin/build-collections/transform-schema-fields-to-payload.js';
import { getAdminAccess } from '../../../utils/plugin/get-admin-access.js';
import { baModelKey } from '../../constants.js';

export function buildMembersCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const memberSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.member);
  const memberSchema = resolvedSchemas[baModelKey.member];

  const existingMemberCollection = incomingCollections.find(
    (collection) => collection.slug === memberSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof Member> = {
    organizationId: () => ({
      index: true,
      admin: {
        readOnly: true,
        description: 'The organization that the member belongs to.',
      },
    }),
    userId: () => ({
      index: true,
      admin: {
        readOnly: true,
        description: 'The user that is a member of the organization.',
      },
    }),
    role: () => ({
      defaultValue: 'member',
      admin: {
        description: 'The role of the member in the organization.',
        // TODO: Add a component to select the role
        components: {},
      },
    }),
  };

  const collectionFields = getCollectionFields({
    schema: memberSchema,
    additionalProperties: fieldOverrides,
  });

  let memberCollection: CollectionConfig = {
    ...existingMemberCollection,
    slug: memberSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      useAsTitle: getSchemaFieldName(resolvedSchemas, baModelKey.member, 'organizationId'),
      description: 'Members of an organization.',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingMemberCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingMemberCollection?.access ?? {}),
    },
    custom: {
      ...(existingMemberCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.member,
    },
    fields: [...(existingMemberCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.members === 'function') {
    memberCollection = pluginOptions.pluginCollectionOverrides.members({
      collection: memberCollection,
    });
  }

  assertAllSchemaFields(memberCollection, memberSchema);

  return memberCollection;
}
