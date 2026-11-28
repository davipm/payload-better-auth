'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Modal, toast, useModal, useTranslation, XIcon } from '@payloadcms/ui';
import { createAuthClient } from 'better-auth/react';
import { useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getErrorCode } from '../../utils/get-error-code.js';
import { Submit, TextField } from '../form/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';

const MODAL_SLUG = 'passkeys-modal';
const baseClass = MODAL_SLUG;

const createPasskeyClient = (baseURL?: string, basePath?: string) =>
  createAuthClient({ baseURL, basePath, plugins: [passkeyClient()] });

type PasskeyAuthClient = ReturnType<typeof createPasskeyClient>;

interface PassKeyAddButtonProps {
  onAdd?: () => void;
  baseURL?: string;
  basePath?: string;
}

// Module-level: a component defined inside another component gets a new identity on every
// parent render, which remounts the form and drops its state and focus.
function AddPasskeyForm({
  authClient,
  onSuccess,
}: {
  authClient: PasskeyAuthClient;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();

  const schema = useMemo(
    () => z.object({ name: z.string().trim().min(1, t('validation:required')).max(64) }),
    [t],
  );

  const form = useForm({
    defaultValues: { name: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      const res = await authClient.passkey.addPasskey({ name });
      if (res?.error) {
        // Dismissing the browser's WebAuthn prompt isn't worth a toast
        if (getErrorCode(res.error) !== 'AUTH_CANCELLED') {
          toast.error(res.error.message || 'Failed to add passkey');
        }
        return;
      }
      toast.success('Passkey added successfully');
      onSuccess();
    } catch {
      toast.error('Failed to add passkey');
    }
  });

  return (
    <Form form={form} onSubmit={onSubmit} className="passkeys-add-form">
      {/* FormInputWrap appends `__inputWrap` itself; the old className doubled it */}
      <FormInputWrap className="passkeys-add-form">
        <TextField
          name="name"
          type="text"
          className="text name"
          label="Passkey Name"
          autoComplete="off"
          required
        />
      </FormInputWrap>
      <Submit label="Create Passkey" loadingLabel="Creating" />
    </Form>
  );
}

export function PassKeyAddButton({ onAdd, baseURL, basePath }: PassKeyAddButtonProps) {
  const { openModal, closeModal, isModalOpen } = useModal();
  const titleId = useId();

  const authClient = useMemo(() => createPasskeyClient(baseURL, basePath), [baseURL, basePath]);

  const close = () => closeModal(MODAL_SLUG);

  return (
    <>
      <Button type="button" onClick={() => openModal(MODAL_SLUG)} size="medium" buttonStyle="pill">
        Add Passkey
      </Button>
      <Modal slug={MODAL_SLUG} className={baseClass} closeOnBlur>
        {/* Mounted only while open → form state resets on every close (blur/esc included) */}
        {isModalOpen(MODAL_SLUG) && (
          <div
            className={`${baseClass}__wrapper`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <Button
              type="button"
              onClick={close}
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
              <h2 id={titleId}>Create New Passkey</h2>
              <p>Securely access your account without a password by creating a new passkey.</p>
              <AddPasskeyForm
                authClient={authClient}
                onSuccess={() => {
                  close();
                  onAdd?.();
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
