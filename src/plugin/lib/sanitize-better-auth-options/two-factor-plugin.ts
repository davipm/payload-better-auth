import type { BetterAuthSchemas } from '../../../types/plugin.js';
import {
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../../../utils/plugin/build-collections/collection-schema.js';
import { set } from '../../../utils/set.js';
import { baModelFieldKeys, baModelKey } from '../../constants.js';

export function configureTwoFactorPlugin(plugin: any, resolvedSchemas: BetterAuthSchemas): void {
  const model = baModelKey.twoFactor;
  set(plugin, `schema.${model}.modelName`, getSchemaCollectionSlug(resolvedSchemas, model));
  set(
    plugin,
    `schema.${model}.fields.userId.fieldName`,
    getSchemaFieldName(resolvedSchemas, model, baModelFieldKeys.twoFactor.userId),
  );
  set(
    plugin,
    `schema.${model}.fields.userId.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );
}
