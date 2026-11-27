'use client';

import {
  Button,
  CopyIcon,
  Modal,
  Select,
  TextInput,
  toast,
  useConfig,
  useModal,
  XIcon,
} from '@payloadcms/ui';
import type { Option } from '@payloadcms/ui/elements/ReactSelect';
import { usePathname } from 'next/navigation.js';
import { type ChangeEvent, useState } from 'react';
import { adminEndpoints } from '../../plugin/constants.js';
import { LoaderCircle } from '../icons.js';
import './index.css';

const MODAL_SLUG = 'admin-invite-modal';
const baseClass = MODAL_SLUG;

type Pending = 'email' | 'link' | null;

interface AdminInviteButtonProps {
  roles: { label: string; value: string }[];
}

async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export function AdminInviteButton({ roles }: AdminInviteButtonProps) {
  const { toggleModal, closeModal, isModalOpen } = useModal();
  const {
    config: {
      routes: { admin: adminRoute },
      admin: { user: userSlug },
    },
  } = useConfig();
  const pathname = usePathname();

  // Only render in the users list view
  if (pathname !== `${adminRoute}/collections/${userSlug}`) return null;

  return (
    <>
      <Button
        onClick={() => toggleModal(MODAL_SLUG)}
        type="button"
        size="medium"
        buttonStyle="pill"
        className="admin-invite-button"
      >
        Invite User
      </Button>
      <Modal slug={MODAL_SLUG} className={baseClass} closeOnBlur>
        {/* Mounted only while open → form state resets on every close (incl. blur/esc) */}
        {isModalOpen(MODAL_SLUG) && (
          <InviteForm roles={roles} onClose={() => closeModal(MODAL_SLUG)} />
        )}
      </Modal>
    </>
  );
}

function InviteForm({ roles, onClose }: AdminInviteButtonProps & { onClose: () => void }) {
  const {
    config: {
      serverURL,
      routes: { api: apiRoute },
      admin: { user: userSlug },
    },
  } = useConfig();

  const [role, setRole] = useState<Option>();
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<{ role: string; link: string }>();
  const [pending, setPending] = useState<Pending>(null);

  const endpoint = (path: string) => `${serverURL}${apiRoute}/${userSlug}${path}`;
  const roleValue = role ? String(role.value) : undefined;
  const canSend = Boolean(roleValue && email.trim());

  const getLink = async (value: string) => {
    if (invite?.role === value) return invite.link;
    const { inviteLink } = await post<{ inviteLink: string }>(
      endpoint(adminEndpoints.generateInviteUrl),
      { role: value },
    );
    setInvite({ role: value, link: inviteLink });
    return inviteLink;
  };

  const run = async (kind: Exclude<Pending, null>, task: () => Promise<string>) => {
    setPending(kind);
    try {
      toast.success(await task());
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  };

  const sendEmail = () => {
    if (!roleValue || !canSend) return;
    return run('email', async () => {
      const link = await getLink(roleValue);
      await post(endpoint(adminEndpoints.sendInvite), { email: email.trim(), link });
      return 'Invite sent successfully';
    });
  };

  const copyLink = () => {
    if (!roleValue) return;
    return run('link', async () => {
      await navigator.clipboard.writeText(await getLink(roleValue));
      return 'Invite link copied to clipboard';
    });
  };

  return (
    <div className={`${baseClass}__wrapper`}>
      <Button
        onClick={onClose}
        type="button"
        buttonStyle="secondary"
        size="medium"
        className={`${baseClass}__close-button`}
        aria-label="Close"
      >
        <span aria-hidden="true">
          <XIcon />
        </span>
      </Button>

      <div className={`${baseClass}__content`}>
        <h2>Invite User</h2>
        <p>
          Invite a user to your application. Select the role of the user and send the invite via
          email or copy the invite link.
        </p>

        <Select
          options={roles}
          value={role}
          placeholder="Select Role"
          onChange={(option: Option | Option[]) =>
            setRole(Array.isArray(option) ? option[0] : option)
          }
        />

        <form
          className={`${baseClass}__invite-controls`}
          onSubmit={(e) => {
            e.preventDefault();
            sendEmail();
          }}
        >
          <div className={`${baseClass}__email-field`}>
            <TextInput
              label="Email Address"
              path="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className={`${baseClass}__buttons`}>
            <Button type="submit" disabled={!canSend || pending !== null}>
              {pending === 'email' && <LoaderCircle className="animate-spin" />}
              Send Email
            </Button>

            <Button
              type="button"
              size="medium"
              buttonStyle="ghost"
              className={`${baseClass}__copy-button`}
              onClick={copyLink}
              disabled={!roleValue || pending !== null}
            >
              {pending === 'link' ? (
                <LoaderCircle strokeWidth={1.5} className="animate-spin" />
              ) : (
                <span aria-hidden="true">
                  <CopyIcon />
                </span>
              )}
              Generate Link
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
