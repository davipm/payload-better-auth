import { isAdmin, isAuthenticated } from '@davipm/payload-better-auth';
import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig<'users'> = {
  slug: 'users',
  timestamps: true,
  auth: true,
  access: {
    admin: isAuthenticated(),
    create: isAdmin(),
    delete: isAuthenticated(),
    read: isAuthenticated(),
    update: isAdmin(),
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
};
