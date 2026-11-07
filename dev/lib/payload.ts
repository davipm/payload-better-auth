import { getPayloadAuth } from '@davipm/payload-better-auth';
import config from '@payload-config';
import type { PayloadAuthConfig } from './auth.js';

export const getPayload = async () => getPayloadAuth<PayloadAuthConfig>(config);
