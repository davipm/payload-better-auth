import type { BetterAuthSchemas, PayloadAuthOptions } from '../../../types/plugin.js';
import { getSchemaCollectionSlug } from '../../../utils/plugin/build-collections/collection-schema.js';
import { set } from '../../../utils/set.js';
import { baModelKey, defaults } from '../../constants.js';

export function configureAdminPlugin(
  plugin: any,
  options: PayloadAuthOptions,
  resolvedSchemas: BetterAuthSchemas,
): void {
  plugin.defaultRole = options.users?.defaultRole ?? defaults.userRole;
  plugin.adminRoles = options.users?.adminRoles ?? [defaults.adminRole];

  set(
    plugin,
    `schema.${baModelKey.session}.fields.impersonatedBy.references.model`,
    getSchemaCollectionSlug(resolvedSchemas, baModelKey.user),
  );
}
