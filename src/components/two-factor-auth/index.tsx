'use client';

import './index.scss';

import {
  Button,
  Modal,
  toast,
  useField,
  useFormFields,
  useModal,
  useTranslation,
} from '@payloadcms/ui';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { Copy, XIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useAppForm } from '../form/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';
import { otpField, passwordField } from '../form/validation.js';

const baseClass = 'two-factor-auth-modal';
const MODAL_SLUG = 'two-factor-auth-modal';

type Step = 'enable' | 'verify' | 'backupCodes' | 'disable';

const createTwoFactorClient = (baseURL?: string, basePath?: string) =>
  createAuthClient({ baseURL, basePath, plugins: [twoFactorClient()] });
type TwoFactorClient = ReturnType<typeof createTwoFactorClient>;

const parseBackupCodes = (raw: unknown): string[] | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw).split(/\s+/).filter(Boolean);
};

const handleSubmit = (submit: () => Promise<void>) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  e.stopPropagation(); // modal lives inside Payload's document <form>
  void submit();
};

/* ---------- Sub-forms (module scope: stable identity, no remount on parent render) ---------- */

function PasswordForm({
  className,
  label,
  loadingLabel,
  onSubmit,
}: {
  className: string;
  label: string;
  loadingLabel: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => z.object({ password: passwordField({ t }) }), [t]);

  const form = useAppForm({
    defaultValues: { password: '' },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => onSubmit(value.password),
  });

  return (
    <Form onSubmit={handleSubmit(form.handleSubmit)} className={className}>
      <FormInputWrap className={`${className}__inputWrap`}>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              type="password"
              className="password"
              autoComplete="current-password"
              label="Password"
              required
            />
          )}
        </form.AppField>
      </FormInputWrap>
      <form.AppForm>
        <form.Submit label={label} loadingLabel={loadingLabel} />
      </form.AppForm>
    </Form>
  );
}

function VerifyForm({
  digits,
  onSubmit,
}: {
  digits: number;
  onSubmit: (code: string) => Promise<void>;
}) {
  const schema = useMemo(() => z.object({ otp: otpField({ digits }) }), [digits]);

  const form = useAppForm({
    defaultValues: { otp: '' },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => onSubmit(value.otp),
  });

  return (
    <Form onSubmit={handleSubmit(form.handleSubmit)} className="two-factor-verify-form">
      <FormInputWrap className="tf__inputWrap">
        <form.AppField name="otp">
          {(field) => (
            <field.TextField
              type="text"
              autoComplete="one-time-code"
              className="text otp"
              label={`${digits}-digit Code`}
              required
            />
          )}
        </form.AppField>
      </FormInputWrap>
      <form.AppForm>
        <form.Submit label="Verify" loadingLabel="Verifying" />
      </form.AppForm>
    </Form>
  );
}

/* ---------- Main ---------- */

interface TwoFactorAuthProps {
  baseURL?: string;
  basePath?: string;
  twoFactorDigits?: number;
}

export function TwoFactorAuth({ baseURL, basePath, twoFactorDigits = 6 }: TwoFactorAuthProps) {
  const [step, setStep] = useState<Step>('enable');
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const { openModal, closeModal } = useModal();
  const twoFactorEnabled = useFormFields(([fields]) => Boolean(fields.twoFactorEnabled?.value));
  const { setValue: setTwoFactorEnabled } = useField<boolean>({ path: 'twoFactorEnabled' });

  const authClient: TwoFactorClient = useMemo(
    () => createTwoFactorClient(baseURL, basePath),
    [baseURL, basePath],
  );

  // Reset on open (covers closeOnBlur / X) so secrets never linger in state
  const open = (next: Step) => {
    setTotpURI('');
    setBackupCodes(null);
    setStep(next);
    openModal(MODAL_SLUG);
  };
  const close = () => closeModal(MODAL_SLUG);

  const copyURI = async () => {
    try {
      await navigator.clipboard.writeText(totpURI);
      toast.success('Copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const enable = async (password: string) => {
    const { data, error } = await authClient.twoFactor.enable({ password });
    if (error || !data) {
      toast.error(error?.message ?? 'Failed to enable two-factor');
      return;
    }
    if (data.method !== 'totp') {
      toast.error('Unsupported two-factor method');
      return;
    }
    setTotpURI(data.totpURI);
    setBackupCodes(parseBackupCodes(data.backupCodes));
    setStep('verify');
  };

  const verify = async (code: string) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Two-factor verified & enabled');
    setTwoFactorEnabled(true);
    setTotpURI('');
    if (backupCodes?.length) setStep('backupCodes');
    else close();
  };

  const disable = async (password: string) => {
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Two-factor disabled');
    setTwoFactorEnabled(false);
    close();
  };

  return (
    <div className="two-factor-auth-field">
      <Button
        onClick={() => open(twoFactorEnabled ? 'disable' : 'enable')}
        size="medium"
        buttonStyle="pill"
      >
        {twoFactorEnabled ? 'Disable' : 'Enable'} Two-Factor
      </Button>

      <Modal slug={MODAL_SLUG} className={baseClass} closeOnBlur>
        <div className={`${baseClass}__wrapper`}>
          <Button
            onClick={close}
            buttonStyle="icon-label"
            size="small"
            className={`${baseClass}__close-button`}
            aria-label="Close"
          >
            <XIcon size={24} />
          </Button>

          <div className={`${baseClass}__content`} style={{ maxWidth: '38rem' }}>
            {step === 'enable' && (
              <>
                <h2>Enable Two-Factor</h2>
                <PasswordForm
                  className="two-factor-enable-form"
                  label="Enable"
                  loadingLabel="Enabling"
                  onSubmit={enable}
                />
              </>
            )}

            {step === 'verify' && (
              <>
                <h2>Verify Two-Factor</h2>
                <div className={`${baseClass}__verify-block`}>
                  <p>Scan the QR code with your authenticator app or copy the URI.</p>
                  <div className={`${baseClass}__qrcode`}>
                    <QRCodeSVG value={totpURI} size={200} />
                  </div>
                  <Button
                    size="small"
                    buttonStyle="transparent"
                    onClick={copyURI}
                    className={`${baseClass}__copy-btn`}
                  >
                    <Copy size={18} className={`${baseClass}__copy-icon`} /> Copy URI
                  </Button>
                  <VerifyForm digits={twoFactorDigits} onSubmit={verify} />
                </div>
              </>
            )}

            {step === 'backupCodes' && backupCodes && (
              <>
                <h2>Backup Codes</h2>
                <div className={`${baseClass}__backup-codes`}>
                  <ul>
                    {backupCodes.map((code) => (
                      <li key={code} className={`${baseClass}__backup-code`}>
                        {code}
                      </li>
                    ))}
                  </ul>
                  <p className={`${baseClass}__backup-desc`}>
                    Store these codes in a safe place. Each code can be used once if you lose access
                    to your authenticator.
                  </p>
                </div>
                <Button
                  onClick={close}
                  buttonStyle="primary"
                  size="large"
                  className={`${baseClass}__backup-codes-close-button`}
                >
                  Saved them!
                </Button>
              </>
            )}

            {step === 'disable' && (
              <>
                <h2>Two-Factor Authentication</h2>
                <PasswordForm
                  className="two-factor-disable-form"
                  label="Disable Two-Factor"
                  loadingLabel="Disabling"
                  onSubmit={disable}
                />
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
