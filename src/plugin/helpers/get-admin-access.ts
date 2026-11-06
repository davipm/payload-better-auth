import { isAdminWithRoles } from '../lib/build-collections/utils/payload-access.js';
import type { PayloadAuthOptions } from '../types.js';

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
