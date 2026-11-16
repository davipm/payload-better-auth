import type { AccessArgs } from 'payload';
import type { User } from '../../src/types/generated-types.js';

type isAuthenticated = (args: AccessArgs<User>) => boolean;

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user);
};
