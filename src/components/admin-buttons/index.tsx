'use client';

import {
  Button,
  ConfirmationModal,
  toast,
  useAuth,
  useDocumentInfo,
  useFormFields,
  useModal,
} from '@payloadcms/ui';
import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
import { type ComponentProps, useState, useTransition } from 'react';
import './index.css';

interface AdminButtonsProps {
  baseURL?: string;
  basePath?: string;
}

type ButtonStyle = NonNullable<ComponentProps<typeof Button>['buttonStyle']>;

const createClient = (baseURL?: string, basePath?: string) =>
  createAuthClient({ baseURL, basePath, plugins: [adminClient()] });

type AdminClient = ReturnType<typeof createClient>;

// One client per config, shared across renders/mounts (not re-created on every render)
const clients = new Map<string, AdminClient>();

const getClient = (baseURL?: string, basePath?: string) => {
  const key = `${baseURL ?? ''}|${basePath ?? ''}`;
  const cached = clients.get(key);
  if (cached) return cached;

  const client = createClient(baseURL, basePath);
  clients.set(key, client);
  return client;
};

type ActionKey = 'impersonate' | 'revoke' | 'ban' | 'unban';

interface ActionDef {
  run: (c: AdminClient, userId: string) => Promise<{ error: { message?: string } | null }>;
  failure: string;
  success?: string;
  redirect?: string;
  confirm?: { heading: string; body: string; label: string };
}

const ACTIONS: Record<ActionKey, ActionDef> = {
  impersonate: {
    run: (c, userId) => c.admin.impersonateUser({ userId }),
    failure: 'Failed to impersonate user',
    redirect: '/', // hard navigation: session cookie changed, drop all cached RSC state
    confirm: {
      heading: 'Impersonate user?',
      body: 'You will be signed in as this user until you stop impersonating.',
      label: 'Impersonate',
    },
  },
  revoke: {
    run: (c, userId) => c.admin.revokeUserSessions({ userId }),
    success: 'All sessions revoked successfully',
    failure: 'Failed to revoke all sessions',
    confirm: {
      heading: 'Revoke all sessions?',
      body: 'The user will be signed out of every device.',
      label: 'Revoke',
    },
  },
  ban: {
    run: (c, userId) => c.admin.banUser({ userId }),
    success: 'User banned successfully',
    failure: 'Failed to ban user',
    confirm: {
      heading: 'Ban user?',
      body: 'The user will be blocked from signing in and their sessions will be revoked.',
      label: 'Ban',
    },
  },
  unban: {
    run: (c, userId) => c.admin.unbanUser({ userId }),
    success: 'User unbanned successfully',
    failure: 'Failed to unban user',
  },
};

export function AdminButtons({ baseURL, basePath }: AdminButtonsProps) {
  const router = useRouter();
  const { id } = useDocumentInfo();
  const { user } = useAuth();
  const { openModal } = useModal();
  const isBanned = useFormFields(([fields]) => Boolean(fields.banned?.value));
  const [active, setActive] = useState<ActionKey | null>(null);
  const [confirming, setConfirming] = useState<ActionKey>('ban');
  const [isRefreshing, startRefresh] = useTransition();

  // No actions on unsaved docs, and never let admins ban / sign out / impersonate themselves
  if (!id || String(user?.id) === String(id)) return null;

  const userId = String(id);
  const modalSlug = `admin-action-${userId}`;
  const busy = active !== null || isRefreshing;

  const execute = async (key: ActionKey) => {
    const def = ACTIONS[key];
    setActive(key);
    try {
      const { error } = await def.run(getClient(baseURL, basePath), userId);
      if (error) {
        toast.error(error.message || def.failure);
        return;
      }
      if (def.success) toast.success(def.success);
      if (def.redirect) window.location.assign(def.redirect);
      else startRefresh(() => router.refresh());
    } catch {
      toast.error(def.failure);
    } finally {
      setActive(null);
    }
  };

  const request = (key: ActionKey) => {
    if (ACTIONS[key].confirm) {
      setConfirming(key);
      openModal(modalSlug);
    } else {
      void execute(key);
    }
  };

  const BUTTONS: Record<ActionKey, { label: string; buttonStyle: ButtonStyle; className: string }> =
    {
      impersonate: { label: 'Impersonate', buttonStyle: 'pill', className: 'impersonate-button' },
      revoke: {
        label: 'Revoke All Sessions',
        buttonStyle: 'secondary',
        className: 'revoke-sessions-button',
      },
      ban: { label: 'Ban', buttonStyle: 'destructive', className: 'ban-button' },
      unban: { label: 'Unban', buttonStyle: 'primary', className: 'unban-button' },
    };

  const confirm = ACTIONS[confirming].confirm;
  const visibleActions: ActionKey[] = ['impersonate', 'revoke', isBanned ? 'unban' : 'ban'];

  return (
    <>
      {visibleActions.map((key) => {
        const { label, buttonStyle, className } = BUTTONS[key];
        return (
          <Button
            key={key}
            onClick={() => request(key)}
            buttonStyle={buttonStyle}
            className={className}
            size="medium"
            disabled={busy}
            aria-busy={active === key}
          >
            {active === key ? `${label}…` : label}
          </Button>
        );
      })}

      <ConfirmationModal
        modalSlug={modalSlug}
        heading={confirm?.heading ?? ''}
        body={confirm?.body ?? ''}
        confirmLabel={confirm?.label}
        onConfirm={() => execute(confirming)}
      />
    </>
  );
}
