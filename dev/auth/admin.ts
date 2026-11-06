import type { Access } from 'payload';

export const authenticatedAdmin: Access = ({ req: { user } }) => {
  const roles = Array.isArray(user?.role) ? user.role : [];
  return roles.includes('admin');
};
