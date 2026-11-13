import type { CollectionConfig } from 'payload';

export const Projects: CollectionConfig<'projects'> = {
  slug: 'projects',
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
