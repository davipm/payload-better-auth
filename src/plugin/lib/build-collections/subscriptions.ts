import type { CollectionConfig } from 'payload';
import type { Subscription } from '../../../types/generated-types.js';
import { baModelKey } from '../../constants.js';
import { getAdminAccess } from '../../../utils/plugin/get-admin-access.js';
import type { BuildCollectionProps, FieldOverrides } from '../../../types/plugin.js';
import {
  assertAllSchemaFields,
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { getCollectionFields } from '../../../utils/plugin/build-collections/transform-schema-fields-to-payload.js';

export function buildSubscriptionsCollection({
  incomingCollections,
  pluginOptions,
  resolvedSchemas,
}: BuildCollectionProps): CollectionConfig {
  const subscriptionsSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.subscription);
  const subscriptionsSchema = resolvedSchemas[baModelKey.subscription];

  const existingSubscriptionCollection = incomingCollections.find(
    (collection) => collection.slug === subscriptionsSlug,
  ) as CollectionConfig | undefined;

  const fieldOverrides: FieldOverrides<keyof Subscription> = {
    plan: () => ({
      index: true,
      admin: {
        readOnly: true,
        description: 'The name of the subscription plan',
      },
    }),
    referenceId: () => ({
      index: true,
      admin: {
        readOnly: true,
        description: 'The ID this subscription is associated with (user ID by default)',
      },
    }),
    stripeCustomerId: () => ({
      index: true,
      admin: { readOnly: true, description: 'The Stripe customer ID' },
    }),
    stripeSubscriptionId: () => ({
      index: true,
      admin: { readOnly: true, description: 'The Stripe subscription ID' },
    }),
    status: () => ({
      index: true,
      admin: {
        description: 'The status of the subscription (active, canceled, etc.)',
      },
    }),
    periodStart: () => ({
      admin: { description: 'Start date of the current billing period' },
    }),
    periodEnd: () => ({
      admin: { description: 'End date of the current billing period' },
    }),
    cancelAtPeriodEnd: () => ({
      admin: {
        description: 'Whether the subscription will be canceled at the end of the period',
      },
    }),
    seats: () => ({
      admin: { description: 'Number of seats for team plans' },
    }),
    trialStart: () => ({
      admin: { description: 'Start date of the trial period' },
    }),
    trialEnd: () => ({
      admin: { description: 'End date of the trial period' },
    }),
  };

  const collectionFields = getCollectionFields({
    schema: subscriptionsSchema,
    additionalProperties: fieldOverrides,
  });

  let subscriptionsCollection: CollectionConfig = {
    ...existingSubscriptionCollection,
    slug: subscriptionsSlug,
    admin: {
      hidden: pluginOptions.hidePluginCollections ?? false,
      useAsTitle: getSchemaFieldName(resolvedSchemas, baModelKey.subscription, 'plan'),
      description: 'Subscriptions are used to manage the subscriptions of the users',
      group: pluginOptions?.collectionAdminGroup ?? 'Auth',
      ...existingSubscriptionCollection?.admin,
    },
    access: {
      ...getAdminAccess(pluginOptions),
      ...(existingSubscriptionCollection?.access ?? {}),
    },
    custom: {
      ...(existingSubscriptionCollection?.custom ?? {}),
      betterAuthModelKey: baModelKey.subscription,
    },
    fields: [...(existingSubscriptionCollection?.fields ?? []), ...(collectionFields ?? [])],
  };

  if (typeof pluginOptions.pluginCollectionOverrides?.subscriptions === 'function') {
    subscriptionsCollection = pluginOptions.pluginCollectionOverrides.subscriptions({
      collection: subscriptionsCollection,
    });
  }

  assertAllSchemaFields(subscriptionsCollection, subscriptionsSchema);

  return subscriptionsCollection;
}
