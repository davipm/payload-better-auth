import { betterAuth } from 'better-auth';
import type { BasePayload } from 'payload';
import { payloadAdapter } from '../../adapter/index.js';
import type {
  BetterAuthFunctionOptions,
  BetterAuthReturn,
  PayloadAuthOptions,
} from '../../types/plugin.js';

export function initBetterAuth<O extends PayloadAuthOptions>({
  payload,
  idType,
  options: { enableDebugLogs = false, ...restOptions },
}: {
  payload: BasePayload;
  idType: 'number' | 'text';
  options: BetterAuthFunctionOptions<O>;
}): BetterAuthReturn<O> {
  return betterAuth({
    ...restOptions,
    database: payloadAdapter({
      payloadClient: payload,
      adapterConfig: {
        enableDebugLogs,
        idType,
      },
    }),
  }) as unknown as BetterAuthReturn<O>;
}
