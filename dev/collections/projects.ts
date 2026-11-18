import { anyone, isAuthenticated } from '@davipm/payload-better-auth';
import type { CollectionConfig } from 'payload';

export const Projects: CollectionConfig<'projects'> = {
  slug: 'projects',
  access: {
    create: isAuthenticated(),
    delete: isAuthenticated(),
    read: anyone(),
    update: isAuthenticated(),
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      options: ['active', 'inactive'],
    },
  ],
};
