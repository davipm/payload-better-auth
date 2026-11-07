import config from '@payload-config';
import { getPayloadAuth } from '@davipm/payload-better-auth';
import type { PayloadAuthConfig } from './auth.js';

export const getPayload = async () => getPayloadAuth<PayloadAuthConfig>(config);
