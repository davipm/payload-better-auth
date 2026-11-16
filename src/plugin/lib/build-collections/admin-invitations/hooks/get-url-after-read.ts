import type { FieldHook } from 'payload';
import type { GenerateAdminInviteUrlFn } from '../../../../../types/plugin.js';

export const getAdminInviteUrlAfterReadHook = ({
  generateAdminInviteUrlFn,
}: {
  generateAdminInviteUrlFn: GenerateAdminInviteUrlFn;
}) => {
  const hook: FieldHook = async ({ req, data }) => {
    return generateAdminInviteUrlFn({
      payload: req.payload,
      token: data?.token,
    });
  };
  return hook;
};
