import type { Access, PayloadRequest } from 'payload';

export type AdminRolesConfig = {
  adminRoles?: string[];
};

export type AdminOrCurrentUserConfig = AdminRolesConfig & {
  idField?: string;
};

export type AdminOrCurrentUserUpdateConfig = AdminOrCurrentUserConfig & {
  allowedFields?: string[];
  userSlug: string;
};

type RequestAccess = (args: { req: PayloadRequest }) => boolean;

export const isAdminWithRoles =
  (config: AdminRolesConfig = {}): RequestAccess =>
  ({ req }) => {
    const { adminRoles = ['admin'] } = config;
    const user = req.user as (typeof req.user & { role?: string | string[] }) | null;
    if (!user || !user.role || !hasAdminRoles(adminRoles)({ req })) return false;
    return true;
  };

export const isAdminOrCurrentUserWithRoles =
  (config: AdminOrCurrentUserConfig = {}): Access =>
  ({ req }) => {
    const { adminRoles = ['admin'], idField = 'id' } = config;
    if (isAdminWithRoles({ adminRoles })({ req })) return true;
    if (!req?.user) return false;
    return {
      [idField]: {
        equals: req?.user?.id,
      },
    };
  };

export const hasAdminRoles = (adminRoles: string[]) => {
  return ({ req }: { req: PayloadRequest }): boolean => {
    let userRoles: string[] = [];
    const user = req.user as (typeof req.user & { role?: string | string[] }) | null;
    if (Array.isArray(user?.role)) {
      userRoles = user.role;
    } else if (typeof user?.role === 'string') {
      if (user.role.includes(',')) {
        userRoles = user.role
          .split(',')
          .map((r: string) => r.trim())
          .filter(Boolean);
      } else if (user.role) {
        userRoles = [user.role];
      }
    }
    if (!userRoles) return false;
    return userRoles.some((role) => adminRoles.includes(role));
  };
};

export const isAdminOrCurrentUserUpdateWithAllowedFields = (
  config: AdminOrCurrentUserUpdateConfig,
): Access => {
  return async ({ req, id, data }) => {
    const { adminRoles = ['admin'], allowedFields = [], userSlug, idField = 'id' } = config;
    const user = req.user as (typeof req.user & { [key: string]: any }) | null;

    if (isAdminWithRoles({ adminRoles })({ req })) return true;

    if (!user) return false;

    if (user[idField] === id && data) {
      const dataKeys = Object.keys(data);
      let effectiveAllowedFields = allowedFields;

      const hasCurrentPassword = dataKeys.includes('currentPassword');
      const hasPassword = dataKeys.includes('password');

      if (hasPassword || hasCurrentPassword) {
        if (!(hasCurrentPassword && hasPassword)) return false;
        try {
          if (!user.email) return false;

          const result = await req.payload.login({
            collection: userSlug,
            data: {
              email: user.email,
              password: data.currentPassword,
            },
          });

          if (!result) return false;

          effectiveAllowedFields = [...allowedFields, 'password', 'currentPassword'];
        } catch (error) {
          return false;
        }
      }

      const hasDisallowedField = dataKeys.some((key) => !effectiveAllowedFields.includes(key));

      return !hasDisallowedField;
    }

    return false;
  };
};
