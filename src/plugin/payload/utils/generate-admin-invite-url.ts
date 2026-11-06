import { adminRoutes } from '../../constants.js';
import type { GenerateAdminInviteUrlFn } from '../../types.js';

export const generateAdminInviteUrl: GenerateAdminInviteUrlFn = ({ payload, token }) => {
  if (!payload?.config?.serverURL) {
    payload.logger.warn(
      'payload.config.serverURL is not set. Set it to generate a full URL for the admin invite link.',
    );
  }
  return `${payload.getAdminURL()}${adminRoutes.adminSignup}?token=${token}`;
};
