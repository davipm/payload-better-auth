import { set } from '../../../utils/set.js';
import { baModelFieldKeys, baModelKey } from '../../constants.js';
import type { BetterAuthSchemas } from '../../types.js';
import {
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../build-collections/utils/collection-schema.js';

export function configureSsoPlugin(plugin: any, resolvedSchemas: BetterAuthSchemas): void {
  const model = baModelKey.ssoProvider;
  set(plugin, `schema.${model}.modelName`, getSchemaCollectionSlug(resolvedSchemas, model));
  set(
    plugin,
    `schema.${model}.fields.userId.fieldName`,
    getSchemaFieldName(resolvedSchemas, model, baModelFieldKeys.ssoProvider.userId),
  );
  set(
    plugin,
    `schema.${model}.fields.userId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );
}
