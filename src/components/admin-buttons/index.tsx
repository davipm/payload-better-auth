'use client';

import { Button, toast, useDocumentInfo, useFormFields } from '@payloadcms/ui';
import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
import { useState } from 'react';

import './index.scss';

interface AdminButtonsProps {
  baseURL?: string;
  basePath?: string;
}

type ActionResult = { error: { message?: string } | null };

export function AdminButtons({ baseURL, basePath }: AdminButtonsProps) {
  const router = useRouter();
  const { id } = useDocumentInfo();
  const isBanned = useFormFields(([fields]) => Boolean(fields.banned?.value));
  const [pending, setPending] = useState(false);
  const authClient = createAuthClient({
    baseURL,
    basePath,
    plugins: [adminClient()],
  });

  if (!id) return null;

  const userId = String(id);

  const run = async (
    action: () => Promise<ActionResult>,
    { success, failure, onDone }: { success?: string; failure: string; onDone: () => void },
  ) => {
    setPending(true);
    try {
      const { error } = await action();
      if (error) {
        toast.error(error.message || failure);
        return;
      }
      if (success) toast.success(success);
      onDone();
    } catch {
      toast.error(failure);
    } finally {
      setPending(false);
    }
  };

  const refresh = () => router.refresh();

  const handleImpersonate = () =>
    run(() => authClient.admin.impersonateUser({ userId }), {
      failure: 'Failed to impersonate user',
      onDone: () => router.push('/'),
    });

  const handleBan = () =>
    run(() => authClient.admin.banUser({ userId }), {
      success: 'User banned successfully',
      failure: 'Failed to ban user',
      onDone: refresh,
    });

  const handleUnban = () =>
    run(() => authClient.admin.unbanUser({ userId }), {
      success: 'User unbanned successfully',
      failure: 'Failed to unban user',
      onDone: refresh,
    });

  const handleRevokeAllSessions = () =>
    run(() => authClient.admin.revokeUserSessions({ userId }), {
      success: 'All sessions revoked successfully',
      failure: 'Failed to revoke all sessions',
      onDone: refresh,
    });

  return (
    <>
      <Button
        onClick={handleImpersonate}
        buttonStyle="pill"
        className="impersonate-button"
        size="medium"
        disabled={pending}
      >
        Impersonate
      </Button>
      <Button
        onClick={handleRevokeAllSessions}
        buttonStyle="secondary"
        className="revoke-sessions-button"
        size="medium"
        disabled={pending}
      >
        Revoke All Sessions
      </Button>
      {isBanned ? (
        <Button
          onClick={handleUnban}
          buttonStyle="primary"
          className="unban-button"
          size="medium"
          disabled={pending}
        >
          Unban
        </Button>
      ) : (
        <Button
          onClick={handleBan}
          buttonStyle="error"
          className="ban-button"
          size="medium"
          disabled={pending}
        >
          Ban
        </Button>
      )}
    </>
  );
}
