import type { PayloadAuthOptions } from '../types.js';

export function getAllRoleOptions(pluginOptions: PayloadAuthOptions) {
  const adminRoles = pluginOptions.users?.adminRoles ?? ['admin'];
  const roles = pluginOptions.users?.roles ?? ['user'];

  return [...new Set([...adminRoles, ...roles])].map((role) => ({
    label: role
      .split(/[-_\s]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    value: role,
  }));
}
