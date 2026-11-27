'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Modal, toast, useModal, XIcon } from '@payloadcms/ui';
import { createAuthClient } from 'better-auth/react';
import type React from 'react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Submit, TextField } from '../form/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';

const baseClass = 'passkeys-modal';

interface PassKeyAddButtonProps {
  onAdd?: () => void;
  baseURL?: string;
  basePath?: string;
}

export function PassKeyAddButton({ onAdd, baseURL, basePath }: PassKeyAddButtonProps) {
  const { openModal, closeModal } = useModal();

  const authClient = useMemo(
    () => createAuthClient({ baseURL, basePath, plugins: [passkeyClient()] }),
    [basePath, baseURL],
  );

  // biome-ignore lint/correctness/noComponentHookFactories: <explanation>
  const AddPasskeyForm: React.FC = () => {
    const nameSchema = z.object({
      name: z.string().min(1, 'Name is required'),
    });

    const form = useForm({
      defaultValues: { name: '' },
      resolver: zodResolver(nameSchema),
      mode: 'onSubmit',
    });

    const onSubmit = form.handleSubmit(async ({ name }) => {
      const res = await authClient.passkey.addPasskey({ name });
      if (res?.error) {
        toast.error(res.error.message);
        return;
      }
      toast.success('Passkey added successfully');
      closeModal('passkeys-modal');
      if (typeof onAdd === 'function') onAdd();
    });

    return (
      <Form form={form} onSubmit={onSubmit} className="passkeys-add-form">
        <FormInputWrap className="passkeys-add-form__inputWrap">
          <TextField name="name" type="text" className="text name" label="Passkey Name" required />
        </FormInputWrap>
        <Submit onSubmit={onSubmit} label="Create Passkey" loadingLabel="Creating" />
      </Form>
    );
  };

  return (
    <>
      <Button onClick={() => openModal('passkeys-modal')} size="medium" buttonStyle="pill">
        Add Passkey
      </Button>
      <Modal slug="passkeys-modal" className={baseClass} closeOnBlur>
        <div className={`${baseClass}__wrapper`}>
          <Button
            onClick={() => closeModal('passkeys-modal')}
            buttonStyle="secondary"
            size="medium"
            className={`${baseClass}__close-button`}
          >
            <span aria-hidden="true">
              <XIcon />
            </span>
          </Button>
          <div className={`${baseClass}__content`} style={{ maxWidth: '30rem' }}>
            <h2>Create New Passkey</h2>
            <p>Securely access your account without a password by creating a new passkey.</p>
            <AddPasskeyForm />
          </div>
        </div>
      </Modal>
    </>
  );
}
