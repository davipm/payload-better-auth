import { addDataAndFileToRequest, type Endpoint } from 'payload';
import { adminEndpoints, baseSlugs, defaults } from '../plugin/constants.js';
import { getPayloadAuth } from '../plugin/index.js';
import type { PayloadAuthOptions } from '../types/plugin.js';
import { generateAdminInviteUrl } from '../utils/generate-admin-invite-url.js';
import { hasAdminRoles } from '../utils/plugin/build-collections/payload-access.js';

interface InviteEndpointProps {
  roles: { label: string; value: string }[];
  pluginOptions: PayloadAuthOptions;
}

export const getGenerateInviteUrlEndpoint = ({
  roles,
  pluginOptions,
}: InviteEndpointProps): Endpoint => {
  const adminRoles = pluginOptions.users?.adminRoles ?? [defaults.adminRole];

  return {
    path: adminEndpoints.generateInviteUrl,
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

      const body = req.data as unknown;
      const generateAdminInviteUrlFn =
        pluginOptions?.adminInvitations?.generateInviteUrl ?? generateAdminInviteUrl;

      if (!body) {
        return Response.json({ message: 'No body provided' }, { status: 400 });
      }

      if (typeof body !== 'object' || !('role' in body)) {
        return Response.json({ message: 'Invalid body' }, { status: 400 });
      }

      const role = (body as { role?: unknown }).role;
      if (typeof role !== 'string' || !roles.some((option) => option.value === role)) {
        return Response.json({ message: 'Invalid role' }, { status: 400 });
      }
      const token = crypto.randomUUID();
      const inviteLink = generateAdminInviteUrlFn({
        payload: req.payload,
        token,
      });
      const expiresAt = new Date(Date.now() + defaults.adminInviteExpiresInMs).toISOString();

      try {
        await req.payload.create({
          collection: pluginOptions.adminInvitations?.slug ?? baseSlugs.adminInvitations,
          overrideAccess: true,
          data: {
            token,
            role,
            url: inviteLink,
            expiresAt,
          },
        });

        return new Response(
          JSON.stringify({
            message: 'Invite link generated successfully',
            inviteLink,
          }),
          {
            status: 200,
          },
        );
      } catch (error) {
        req.payload.logger.error({ err: error, msg: 'Failed to generate admin invite URL' });
        return Response.json({ message: 'Error generating invite link' }, { status: 500 });
      }
    },
  };
};
