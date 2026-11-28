/** better-auth's error union only has `code` on some members; this narrows safely. */
export const getErrorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
