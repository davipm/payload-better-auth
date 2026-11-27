import { addDataAndFileToRequest, type Endpoint, headersWithCors, killTransaction } from 'payload';
import { z } from 'zod';
import { adminEndpoints, defaults } from '../plugin/constants.js';
import { getPayloadAuth } from '../plugin/index.js';
import type { PayloadAuthOptions } from '../types/plugin.js';
import { hasAdminRoles } from '../utils/plugin/build-collections/payload-access.js';

const requestSchema = z.object({
  email: z.email(),
  link: z.string(),
});

export const getSendInviteUrlEndpoint = (pluginOptions: PayloadAuthOptions): Endpoint => {
  const adminRoles = pluginOptions.users?.adminRoles ?? [defaults.adminRole];

  return {
    path: adminEndpoints.sendInvite,
    method: 'post',
    handler: async (req) => {
      await addDataAndFileToRequest(req);

      if (!req.user) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      }
      if (!hasAdminRoles(adminRoles)({ req })) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }

      // Belt-and-suspenders: also validate the Better Auth session
      // to catch cases where a Payload JWT is stale but the BA session was revoked
      const payloadAuth = await getPayloadAuth(req.payload.config);
      const session = await payloadAuth.betterAuth.api.getSession({
        headers: req.headers,
      });
      if (!session) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      }

      const { t } = req;
      const body = requestSchema.safeParse(req.data);
      if (!body.success) {
        return Response.json({ message: body.error.message }, { status: 400 });
      }

      const sendInviteEmailFn = pluginOptions.adminInvitations?.sendInviteEmail;

      if (!sendInviteEmailFn) {
        req.payload.logger.error(
          'Send admin invite email function not configured, please add the function to the betterAuthPlugin options.',
        );
        return Response.json(
          { message: 'Send invite email function not found' },
          { status: 500 },
        );
      }

      try {
        const res = await sendInviteEmailFn({
          payload: req.payload,
          email: body.data.email,
          url: body.data.link,
        });

        if (!res.success) {
          return Response.json(
            { message: res.message },
            { status: 500 },
          );
        }

        return Response.json(
          {
            message: t('general:success'),
          },
          {
            headers: headersWithCors({
              headers: new Headers(),
              req,
            }),
            status: 200,
          },
        );
      } catch (error) {
        await killTransaction(req);
        throw error;
      }
    },
  };
};
