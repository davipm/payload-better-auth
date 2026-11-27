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
const EMAIL_RE = /^\S+@\S+\.\S+$/;

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
  if (!res.ok) {
    // Payload errors come back as { errors: [{ message }] }
    throw new Error(
      data?.errors?.[0]?.message ?? data?.message ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

// Safari drops the user gesture after an `await`, so writeText() fails if the link
// must be fetched first. Handing ClipboardItem the pending promise keeps the write
// inside the click gesture.
async function writeClipboard(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(await text);
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
  const emailValid = EMAIL_RE.test(email.trim());
  const canSend = Boolean(roleValue && emailValid);
  const busy = pending !== null;

  // Reuses the generated link while the selected role hasn't changed
  const getLink = async (value: string) => {
    if (invite?.role === value) return invite.link;
    const { inviteLink } = await post<{ inviteLink: string }>(
      endpoint(adminEndpoints.generateInviteUrl),
      { role: value },
    );
    setInvite({ role: value, link: inviteLink });
    return inviteLink;
  };

  // task() runs synchronously up to its first await, so clipboard writes
  // started inside it still count as part of the click gesture.
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
    if (!roleValue || !canSend || busy) return;
    void run('email', async () => {
      const link = await getLink(roleValue);
      await post(endpoint(adminEndpoints.sendInvite), { email: email.trim(), link });
      return 'Invite sent successfully';
    });
  };

  const copyLink = () => {
    if (!roleValue || busy) return;
    void run('link', async () => {
      await writeClipboard(getLink(roleValue));
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
            <Button type="submit" disabled={!canSend || busy}>
              {pending === 'email' && <LoaderCircle className="animate-spin" />}
              Send Email
            </Button>

            <Button
              type="button"
              size="medium"
              buttonStyle="ghost"
              className={`${baseClass}__copy-button`}
              onClick={copyLink}
              disabled={!roleValue || busy}
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
