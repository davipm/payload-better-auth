import { baModelKey } from '../../constants.js';
import type { BetterAuthSchemas } from '../../types.js';
import { set } from '../../../utils/set.js';
import { getSchemaCollectionSlug } from '../build-collections/utils/collection-schema.js';

export function configureDeviceAuthorizationPlugin(
  plugin: any,
  resolvedSchemas: BetterAuthSchemas,
): void {
  set(
    plugin,
    `schema.${baModelKey.deviceCode}.modelName`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.deviceCode),
  );
}
