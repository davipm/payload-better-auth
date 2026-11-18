import type { CollectionConfig } from 'payload';
import { isAdmin, isAuthenticated } from '../utils/auth.js';

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
