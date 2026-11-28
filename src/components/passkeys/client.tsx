'use client';

import { ConfirmationModal, toast, useConfig, useModal } from '@payloadcms/ui';
import { useCallback, useState } from 'react';
import type { PasskeysClientComponentProps, PasskeyWithId } from '../../types/passkeys.js';
import { PassKeyAddButton } from './add-button.js';
import { PasskeyList } from './list.js';

const DELETE_MODAL_SLUG = 'passkey-delete-modal';

export function PasskeysClient({
  initialPasskeys,
  documentId,
  canAdd,
  passkeySlug,
  passkeyUserIdFieldName,
  baseURL,
  basePath,
}: PasskeysClientComponentProps) {
  const {
    config: {
      serverURL,
      routes: { api: apiRoute },
    },
  } = useConfig();
  const { openModal } = useModal();

  const [passkeys, setPasskeys] = useState<PasskeyWithId[]>(initialPasskeys);
  const [target, setTarget] = useState<PasskeyWithId | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const collectionURL = `${serverURL}${apiRoute}/${passkeySlug}`;

  // No fetch on mount: `initialPasskeys` already came from the server.
  // Only refetch after a mutation we can't mirror locally (add).
  const refetch = useCallback(async () => {
    const params = new URLSearchParams({
      [`where[${passkeyUserIdFieldName}][equals]`]: String(documentId),
      sort: '-createdAt',
      limit: '100',
      depth: '0',
    });
    try {
      const res = await fetch(`${collectionURL}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      const { docs } = (await res.json()) as { docs: PasskeyWithId[] };
      setPasskeys(docs);
    } catch {
      toast.error('Failed to refresh passkeys');
    }
  }, [collectionURL, passkeyUserIdFieldName, documentId]);

  const requestDelete = (passkey: PasskeyWithId) => {
    setTarget(passkey);
    openModal(DELETE_MODAL_SLUG);
  };

  const confirmDelete = async () => {
    if (!target) return;
    const { id } = target;
    setDeletingId(id);
    try {
      const res = await fetch(`${collectionURL}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success('Passkey deleted');
    } catch {
      toast.error('Failed to delete passkey');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PasskeyList passkeys={passkeys} deletingId={deletingId} onDelete={requestDelete} />
      {canAdd && (
        <PassKeyAddButton onAdd={() => void refetch()} baseURL={baseURL} basePath={basePath} />
      )}
      <ConfirmationModal
        modalSlug={DELETE_MODAL_SLUG}
        heading="Delete passkey?"
        body={`"${target?.name || 'My Passkey'}" will no longer work for signing in.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  );
}
