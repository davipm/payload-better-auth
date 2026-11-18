import type { Access } from 'payload';

type PublishedConfig = {
  /** Field holding draft/published state. Default: '_status' */
  statusField?: string;
  /** Value that means published. Default: 'published' */
  publishedValue?: string;
};

export const authenticatedOrPublished =
  (config?: PublishedConfig): Access =>
  ({ req: { user } }) => {
    if (user) return true;

    return {
      [config?.statusField ?? '_status']: { equals: config?.publishedValue ?? 'published' },
    };
  };
