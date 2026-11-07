import type { CollectionConfig } from 'payload';
import { authenticatedAdmin } from '../auth/admin.js';
import { authenticated } from '../auth/authenticated.js';

export const Users: CollectionConfig = {
  slug: 'users',
  timestamps: true,
  auth: true,
  access: {
    admin: authenticated,
    create: authenticatedAdmin,
    delete: authenticated,
    read: authenticated,
    update: authenticatedAdmin,
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
