import type { BetterAuthSchemas } from '../../../types/plugin.js';
import { getSchemaCollectionSlug } from '../../../utils/plugin/build-collections/collection-schema.js';
import { set } from '../../../utils/set.js';
import { baModelKey } from '../../constants.js';

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
