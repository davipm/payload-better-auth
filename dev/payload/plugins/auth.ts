import { betterAuthPlugin } from '@davipm/payload-better-auth';
import { payloadAuthOptions } from '../../lib/auth.js';

export const payloadAuth = () => betterAuthPlugin(payloadAuthOptions);
