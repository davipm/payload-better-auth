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
  return roles.some((role) => owned.includes(role));
};

const hasAll = (user: unknown, roles: string[], roleField?: string) => {
  if (!user || roles.length === 0) return false;
  const owned = userRoles(user, roleField);
  return roles.every((role) => owned.includes(role));
};

/**
 * Determines whether the provided user has at least one configured administrative role.
 *
 * Uses the roles and role field defined by the optional configuration, falling back to
 * the default administrative roles when none are provided.
 *
 * @param user The user value to evaluate.
 * @param config Optional configuration that controls which roles are considered administrative.
 * @returns True if the user has any administrative role; otherwise, false.
 */
export const adminCheck = (user: unknown, config?: AdminConfig) =>
  hasAny(user, config?.adminRoles ?? DEFAULT_ADMIN_ROLES, config?.roleField);

/**
 * Creates an access predicate that grants access to admin users.
 *
 * @param config - Optional configuration used to customize the admin check.
 * @returns A BooleanAccess function that determines whether the request user has admin access.
 */
export const isAdmin =
  (config?: AdminConfig): BooleanAccess =>
  ({ req: { user } }) =>
    adminCheck(user, config);

export const isAdminField =
  (config?: AdminConfig): FieldAccess =>
  ({ req: { user } }) =>
    adminCheck(user, config);

/**
 * Creates an access control predicate that allows access for administrators or restricts access to the current user's own records.
 *
 * Returns false when no authenticated user is present. Returns true when the authenticated user satisfies the admin check. Otherwise, returns a Where constraint matching the configured identifier field, or "id" by default, to the authenticated user's id.
 *
 * @param config - Optional self-access configuration, including the user identifier field used for ownership matching.
 * @returns An access function that grants full access to admins, denies unauthenticated requests, or filters records to the authenticated user.
 */
export const isAdminOrSelf =
  (config?: SelfConfig): Access =>
  ({ req: { user } }) => {
    if (!user) return false;
    if (adminCheck(user, config)) return true;
    const where: Where = { [config?.idField ?? 'id']: { equals: (user as unknown as AnyUser).id } };
    return where;
  };

/**
 * Creates an access control function that allows authenticated users to update only their own record.
 *
 * Administrators, as determined by the provided configuration, are granted unrestricted access.
 * Non-administrative users may update only approved fields and only when the target document matches
 * their own user ID. For bulk or access-query operations where no document ID is provided, access is
 * constrained to records whose ID equals the authenticated user's ID.
 *
 * Returns false when no authenticated user is present, when disallowed fields are included in the
 * update data, or when a single-document update targets a different user.
 *
 * @param config Optional configuration used to customize administrative checks and allowed update fields.
 * @returns An access control function that returns true, false, or a query constraint limiting access to the authenticated user's own record.
 */
export const canUpdateOwnFields =
  (config?: UpdateOwnFieldsConfig): Access =>
  ({ req: { user }, id, data }) => {
    if (!user) return false;
    if (adminCheck(user, config)) return true;

    const allowed = new Set(config?.allowedFields ?? ['name', 'image']);
    if (data && !Object.keys(data).every((key) => allowed.has(key))) return false;

    const selfId = (user as unknown as AnyUser).id;
    // Single-document update: id must match. Access operation / bulk: constrain by query.
    if (id != null) return String(id) === String(selfId);
    const where: Where = { id: { equals: selfId } };
    return where;
  };

/**
 * Determines whether the current request is associated with an authenticated user.
 *
 * Returns an access control function that grants access when `req.user` is present
 * and denies access otherwise.
 */
export const isAuthenticated =
  (): BooleanAccess =>
  ({ req: { user } }) =>
    !!user;

/**
 * Creates a field-level access control function that allows access only when the request contains an authenticated user.
 *
 * @returns A field access predicate that returns true when the request has a user, otherwise false.
 */
export const isAuthenticatedField =
  (): FieldAccess =>
  ({ req: { user } }) =>
    !!user;

/**
 * Creates a field-level access control function that allows access only when the request contains an authenticated user.
 *
 * @returns A field access predicate that returns true when the request has a user, otherwise false.
 */
export const anyone = (): BooleanAccess => () => true;

/**
 * Creates a field-level access control function that allows unrestricted access.
 *
 * @returns A field access predicate that always returns true.
 */
export const anyoneField = (): FieldAccess => () => true;

/**
 * Creates an access control predicate that grants access when the current user
 * has at least one of the specified roles.
 *
 * @param roles - The roles that are allowed access.
 * @param roleField - Optional user field to inspect for role values.
 * @returns A BooleanAccess function that evaluates the request user against the allowed roles.
 */
export const hasRole =
  (roles: string[], roleField?: string): BooleanAccess =>
  ({ req: { user } }) =>
    hasAny(user, roles, roleField);

/**
 * Creates a field access control function that grants access when the current user
 * has at least one of the specified roles.
 *
 * @param roles - Roles that are allowed to access the field.
 * @param roleField - Optional user field used to resolve assigned roles.
 * @returns A field access function that evaluates the authenticated user's roles.
 */
export const hasRoleField =
  (roles: string[], roleField?: string): FieldAccess =>
  ({ req: { user } }) =>
    hasAny(user, roles, roleField);

/**
 * Creates a predicate that grants access only when the provided user is recognized
 * as an administrator.
 *
 * @param roles - Roles that are allowed to access the field.
 * @param roleField - Optional user field used to resolve assigned roles.
 * @returns A field access function that evaluates the authenticated user's roles.
 */
export const requireAllRoles =
  (roles: string[], roleField?: string): BooleanAccess =>
  ({ req: { user } }) =>
    hasAll(user, roles, roleField);

/** Collection/global: `admin.hidden`. Hides from nav + routes unless user is admin. */
/**
 * Creates a predicate that hides content unless the provided user is recognized
 * as an administrator.
 *
 * @param {AdminConfig} [config] Optional admin-check configuration.
 * @returns {(context: { user?: unknown }) => boolean} A predicate that returns `true` when content should be hidden.
 */
export const hiddenUnlessAdmin =
  (config?: AdminConfig) =>
  ({ user }: { user?: unknown }): boolean =>
    !adminCheck(user, config);

/** Field: `admin.condition`. Renders the field only for admins. */
/**
 * Creates a predicate that grants access only when the provided user is recognized
 * as an administrator.
 *
 * @param {AdminConfig} [config] Optional admin-check configuration.
 * @returns {(context: { user?: unknown }) => boolean} A predicate that returns `true` when content should be shown.
 */
export const showForAdmin =
  (config?: AdminConfig) =>
  (_data: unknown, _siblingData: unknown, { user }: { user?: unknown }): boolean =>
    adminCheck(user, config);

/** Collection/global: hide unless user has any of the given roles. */
/**
 * Creates a field access control function that grants access when the current user
 * does not have any of the specified roles.
 *
 * @param roles - Roles that are not allowed to access the field.
 * @param roleField - Optional user field used to resolve assigned roles.
 * @returns A field access function that evaluates the authenticated user's roles.
 */
export const hiddenUnlessRole =
  (roles: string[], roleField?: string) =>
  ({ user }: { user?: unknown }): boolean =>
    !hasAny(user, roles, roleField);

/** Field: show only for users with any of the given roles. */
/**
 * Creates a field access control function that grants access when the current user
 * has any of the specified roles.
 *
 * @param roles - Roles that are allowed to access the field.
 * @param roleField - Optional user field used to resolve assigned roles.
 * @returns A field access function that evaluates the authenticated user's roles.
 */
export const showForRole =
  (roles: string[], roleField?: string) =>
  (_data: unknown, _siblingData: unknown, { user }: { user?: unknown }): boolean =>
    hasAny(user, roles, roleField);
