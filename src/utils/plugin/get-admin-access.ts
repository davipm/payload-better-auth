import type { PayloadAuthOptions } from '../../types/plugin.js';
import { isAdminWithRoles } from './build-collections/payload-access.js';

export function getAdminAccess(pluginOptions: PayloadAuthOptions) {
  const adminRoles = pluginOptions.users?.adminRoles ?? ['admin'];
  return {
    create: isAdminWithRoles({
      adminRoles,
    }),
    read: isAdminWithRoles({
      adminRoles,
    }),
    update: isAdminWithRoles({
      adminRoles,
    }),
    delete: isAdminWithRoles({
      adminRoles,
    }),
  };
}
