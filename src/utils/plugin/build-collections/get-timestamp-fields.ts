import type { Field } from 'payload';

interface GetTimestampFieldsOptions {
  saveUpdatedAtToJWT?: boolean;
  saveCreatedAtToJWT?: boolean;
}

export function getTimestampFields(
  options: GetTimestampFieldsOptions = {
    saveUpdatedAtToJWT: true,
    saveCreatedAtToJWT: true,
  },
): Field[] {
  return [
    {
      name: 'updatedAt',
      type: 'date',
      saveToJWT: options.saveUpdatedAtToJWT as any,
      admin: {
        disabled: { bulkEdit: true },
        hidden: true,
      },
      index: true,
      label: ({ t }) => t('general:updatedAt'),
    },
    {
      name: 'createdAt',
      saveToJWT: options.saveCreatedAtToJWT as any,
      admin: {
        disabled: { bulkEdit: true },
        hidden: true,
      },
      type: 'date',
      index: true,
      label: ({ t }) => t('general:createdAt'),
    },
  ];
}
