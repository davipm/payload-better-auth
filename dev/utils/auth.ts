// access/helpers.ts
import type { Access, FieldAccess, PayloadRequest, Where } from 'payload';

type AnyUser = { id: string | number } & Record<string, unknown>;

export type BooleanAccess = (args: { req: PayloadRequest }) => boolean;

export type AdminConfig = {
  /** Roles treated as admin. Default: ['admin'] */
  adminRoles?: string[];
  /** Field on the user holding the role(s). Default: 'role' */
  roleField?: string;
};

export type SelfConfig = AdminConfig & {
  /** Field matched against the user's id. Default: 'id' */
  idField?: string;
};

export type UpdateOwnFieldsConfig = AdminConfig & {
  /** Fields a non-admin may touch on their own record. Default: ['name', 'image'] */
  allowedFields?: string[];
};

const DEFAULT_ADMIN_ROLES = ['admin'];
const DEFAULT_ROLE_FIELD = 'role';

const toRoles = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim())
    : typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

const userRoles = (user: unknown, roleField = DEFAULT_ROLE_FIELD): string[] =>
  user ? toRoles((user as AnyUser)[roleField]) : [];

const hasAny = (user: unknown, roles: string[], roleField?: string) => {
  const owned = userRoles(user, roleField);
  return roles.some((r) => owned.includes(r));
};

const hasAll = (user: unknown, roles: string[], roleField?: string) => {
  if (!user || roles.length === 0) return false;
  const owned = userRoles(user, roleField);
  return roles.every((r) => owned.includes(r));
};

export const adminCheck = (user: unknown, config?: AdminConfig) =>
  hasAny(user, config?.adminRoles ?? DEFAULT_ADMIN_ROLES, config?.roleField);

// ───────────── Admin ─────────────

export const isAdmin =
  (config?: AdminConfig): BooleanAccess =>
  ({ req: { user } }) =>
    adminCheck(user, config);

export const isAdminField =
  (config?: AdminConfig): FieldAccess =>
  ({ req: { user } }) =>
    adminCheck(user, config);

// ───────────── Admin or self ─────────────

export const isAdminOrSelf =
  (config?: SelfConfig): Access =>
  ({ req: { user } }) => {
    if (!user) return false;
    if (adminCheck(user, config)) return true;
    const where: Where = { [config?.idField ?? 'id']: { equals: (user as unknown as AnyUser).id } };
    return where;
  };

// ───────────── Update own fields ─────────────

export const canUpdateOwnFields =
  (config?: UpdateOwnFieldsConfig): Access =>
  ({ req: { user }, id, data }) => {
    if (!user) return false;
    if (adminCheck(user, config)) return true;

    const allowed = new Set(config?.allowedFields ?? ['name', 'image']);
    if (data && !Object.keys(data).every((k) => allowed.has(k))) return false;

    const selfId = (user as unknown as AnyUser).id;
    // Single-doc update: id must match. Access-operation / bulk: constrain by query.
    if (id != null) return String(id) === String(selfId);
    const where: Where = { id: { equals: selfId } };
    return where;
  };

// ───────────── Authenticated ─────────────

export const isAuthenticated =
  (): BooleanAccess =>
  ({ req: { user } }) =>
    !!user;

export const isAuthenticatedField =
  (): FieldAccess =>
  ({ req: { user } }) =>
    !!user;

export const anyone = (): BooleanAccess => () => true;

export const anyoneField = (): FieldAccess => () => true;

// ───────────── Roles ─────────────

export const hasRole =
  (roles: string[], roleField?: string): BooleanAccess =>
  ({ req: { user } }) =>
    hasAny(user, roles, roleField);

export const hasRoleField =
  (roles: string[], roleField?: string): FieldAccess =>
  ({ req: { user } }) =>
    hasAny(user, roles, roleField);

export const requireAllRoles =
  (roles: string[], roleField?: string): BooleanAccess =>
  ({ req: { user } }) =>
    hasAll(user, roles, roleField);

// ───────────── Admin UI visibility ─────────────

/** Collection/global: `admin.hidden`. Hides from nav + routes unless user is admin. */
export const hiddenUnlessAdmin =
  (config?: AdminConfig) =>
  ({ user }: { user?: unknown }): boolean =>
    !adminCheck(user, config);

/** Field: `admin.condition`. Renders the field only for admins. */
export const showForAdmin =
  (config?: AdminConfig) =>
  (_data: unknown, _siblingData: unknown, { user }: { user?: unknown }): boolean =>
    adminCheck(user, config);

/** Collection/global: hide unless user has any of roles. */
export const hiddenUnlessRole =
  (roles: string[], roleField?: string) =>
  ({ user }: { user?: unknown }): boolean =>
    !hasAny(user, roles, roleField);

/** Field: show only for users with any of roles. */
export const showForRole =
  (roles: string[], roleField?: string) =>
  (_data: unknown, _siblingData: unknown, { user }: { user?: unknown }): boolean =>
    hasAny(user, roles, roleField);

/**
 * some examples of Usage:
 *
 * import type { CollectionConfig } from 'payload'
 * import {
 *   isAdmin, isAdminField, isAdminOrSelf, canUpdateOwnFields, isAuthenticated, hasRole, requireAllRoles,
 * } from '@/access/helpers'
 *
 * export const Users: CollectionConfig = {
 *   slug: 'users',
 *   access: {
 *     read: isAdminOrSelf(),
 *     create: isAdmin(),
 *     update: canUpdateOwnFields({ allowedFields: ['name', 'image'] }),
 *     delete: isAdmin({ adminRoles: ['admin', 'superadmin'] }),
 *   },
 *   fields: [
 *     { name: 'role', type: 'text', access: { update: isAdminField(), create: isAdminField() } },
 *   ],
 * }
 *
 * export const Posts: CollectionConfig = {
 *   slug: 'posts',
 *   access: {
 *     read: isAuthenticated(),
 *     update: hasRole(['editor', 'admin']),
 *     delete: requireAllRoles(['admin', 'billing']),
 *   },
 *   fields: [],
 * }
 *
 * import type { CollectionConfig } from 'payload'
 * import { isAdmin, isAdminOrSelf, canUpdateOwnFields } from '@/access/helpers'
 *
 * export const Users: CollectionConfig = {
 *   slug: 'users',
 *   access: {
 *     read: isAdminOrSelf(),
 *     update: canUpdateOwnFields({ allowedFields: ['name', 'image'] }),
 *     delete: isAdmin(),
 *   },
 *   fields: [
 *     {
 *       name: 'role',
 *       type: 'text',
 *       access: { create: isAdminField(), update: isAdminField() },
 *     },
 *   ],
 * }
 *
 * export const Users: CollectionConfig = {
 *   slug: 'users',
 *   admin: { hidden: hiddenUnlessAdmin() },
 *   access: {
 *     read: isAdminOrSelf(),
 *     update: canUpdateOwnFields({ allowedFields: ['name', 'image'] }),
 *     delete: isAdmin(),
 *   },
 *   fields: [
 *     {
 *       name: 'role',
 *       type: 'text',
 *       access: { create: isAdminField(), update: isAdminField() },
 *       admin: { condition: showForAdmin() },
 *     },
 *   ],
 * }
 */
