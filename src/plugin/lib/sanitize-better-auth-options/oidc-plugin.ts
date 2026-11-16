import { set } from '../../../utils/set.js';
import { baModelFieldKeys, baModelKey } from '../../constants.js';
import type { BetterAuthSchemas } from '../../../types/plugin.js';
import {
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../../../utils/plugin/build-collections/collection-schema.js';

export function configureOidcPlugin(plugin: any, resolvedSchemas: BetterAuthSchemas): void {
  const models = [
    baModelKey.oauthClient,
    baModelKey.oauthAccessToken,
    baModelKey.oauthConsent,
  ] as const;

  // biome-ignore lint/suspicious/useIterableCallbackReturn: <explanation>
  models.forEach((model) =>
    set(plugin, `schema.${model}.modelName`, getSchemaCollectionSlug(resolvedSchemas, model)),
  );

  set(
    plugin,
    `schema.${baModelKey.oauthClient}.fields.userId.fieldName`,
    getSchemaFieldName(
      resolvedSchemas,
      baModelKey.oauthClient,
      baModelFieldKeys.oauthClient.userId,
    ),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthClient}.fields.userId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );

  set(
    plugin,
    `schema.${baModelKey.oauthAccessToken}.fields.userId.fieldName`,
    getSchemaFieldName(
      resolvedSchemas,
      baModelKey.oauthAccessToken,
      baModelFieldKeys.oauthAccessToken.userId,
    ),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthAccessToken}.fields.userId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthAccessToken}.fields.clientId.fieldName`,
    getSchemaFieldName(
      resolvedSchemas,
      baModelKey.oauthAccessToken,
      baModelFieldKeys.oauthAccessToken.clientId,
    ),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthAccessToken}.fields.clientId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.oauthClient),
  );

  set(
    plugin,
    `schema.${baModelKey.oauthConsent}.fields.userId.fieldName`,
    getSchemaFieldName(
      resolvedSchemas,
      baModelKey.oauthConsent,
      baModelFieldKeys.oauthConsent.userId,
    ),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthConsent}.fields.userId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthConsent}.fields.clientId.fieldName`,
    getSchemaFieldName(
      resolvedSchemas,
      baModelKey.oauthConsent,
      baModelFieldKeys.oauthConsent.clientId,
    ),
  );
  set(
    plugin,
    `schema.${baModelKey.oauthConsent}.fields.clientId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.oauthClient),
  );
}
