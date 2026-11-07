import type { DBAdapterInstance } from 'better-auth';
import type { BasePayload } from 'payload';

export type PayloadAdapterParams = {
  payloadClient: BasePayload | Promise<BasePayload> | (() => Promise<BasePayload>);
  adapterConfig: {
    enableDebugLogs?: boolean;
    idType: 'number' | 'text';
  };
};

export type PayloadAdapter = (options: PayloadAdapterParams) => DBAdapterInstance;
