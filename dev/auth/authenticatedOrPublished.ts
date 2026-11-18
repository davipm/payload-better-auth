import { type AdminConfig, adminCheck } from '@davipm/payload-better-auth';
import type { Access, Where } from 'payload';

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

export const isAdminOrPublished =
  (config?: AdminConfig & PublishedConfig): Access =>
  ({ req: { user } }) => {
    if (adminCheck(user, config)) return true;
    const where: Where = {
      [config?.statusField ?? '_status']: { equals: config?.publishedValue ?? 'published' },
    };
    return where;
  };
