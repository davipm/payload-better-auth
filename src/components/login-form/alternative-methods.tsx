'use client';

import { Button, toast } from '@payloadcms/ui';
import { useState } from 'react';
import { socialProviders } from '../../plugin/constants.js';
import type { SocialProvider } from '../../types/plugin.js';
import { getErrorCode } from '../../utils/get-error-code.js';
import { isValidEmail } from '../form/validation.js';
import { Icons, Key, Mail } from '../icons.js';
import { useLoginForm } from './context.js';
import './index.css';

const baseClass = 'login-form-methods';

const isSocialProvider = (method: string): method is SocialProvider =>
  (socialProviders as readonly string[]).includes(method);

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface MethodButtonProps {
  disabled: boolean;
  pending: string | null;
  run: (method: string, task: () => Promise<void>) => Promise<void>;
}

function MagicLinkButton({ disabled, pending, run }: MethodButtonProps) {
  const { email, authClient, redirectUrl, showIconOnly } = useLoginForm();
  // Derived: editing the email automatically flips back to "Magic Link" (no effect/ref needed)
  const [sentTo, setSentTo] = useState<string>();
  const sent = sentTo === email;

  const handleClick = () =>
    run('magicLink', async () => {
      if (!email) {
        toast.error('Please enter your email address');
        return;
      }
      if (!isValidEmail(email)) {
        toast.error('Please enter a valid email address');
        return;
      }
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: redirectUrl });
      if (error) {
        toast.error(error.message || 'Failed to send magic link');
        return;
      }
      setSentTo(email);
      toast.success('Magic link sent! Check your email.');
    });

  const label = pending === 'magicLink' ? 'Sending...' : sent ? 'Resend Magic Link' : 'Magic Link';

  return (
    <Button
      type="button"
      size="large"
      className={`${baseClass}__button provider--magic-link`}
      onClick={handleClick}
      disabled={disabled}
      iconPosition="left"
      icon={<Mail className={`${baseClass}__icon`} />}
      tooltip={showIconOnly ? 'Sign in with Magic Link' : undefined}
    >
      {!showIconOnly && <span>{label}</span>}
    </Button>
  );
}

function PasskeyButton({ disabled, run }: MethodButtonProps) {
  const { authClient, redirectUrl, showIconOnly } = useLoginForm();

  const handleClick = () =>
    run('passkey', async () => {
      const { error } = await authClient.signIn.passkey();
      if (error) {
        // The user dismissing the browser prompt isn't worth an error toast
        if (getErrorCode(error) !== 'AUTH_CANCELLED') {
          toast.error(error.message || 'Failed to sign in with passkey');
        }
        return;
      }
      window.location.assign(redirectUrl);
    });

  return (
    <Button
      type="button"
      size="large"
      className={`${baseClass}__button provider--passkey`}
      onClick={handleClick}
      disabled={disabled}
      iconPosition="left"
      icon={<Key className={`${baseClass}__icon`} />}
      tooltip={showIconOnly ? 'Sign in with Passkey' : undefined}
    >
      {!showIconOnly && <span>Passkey</span>}
    </Button>
  );
}

function SocialButton({
  provider,
  disabled,
  run,
}: Pick<MethodButtonProps, 'disabled' | 'run'> & { provider: SocialProvider }) {
  const { authClient, redirectUrl, isSignup, showIconOnly, adminInviteToken } = useLoginForm();
  const Icon = Icons[provider as keyof typeof Icons] ?? null;
  const providerName = capitalize(provider);
  const invite = isSignup && adminInviteToken ? { adminInviteToken } : undefined;

  const handleClick = () =>
    run(provider, async () => {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: redirectUrl,
        errorCallbackURL: window.location.href,
        ...(isSignup && { requestSignUp: true }),
        ...(invite && { additionalData: invite, fetchOptions: { query: invite } }),
      });
      if (error) toast.error(error.message || `Failed to sign in with ${providerName}`);
    });

  return (
    <Button
      type="button"
      size="large"
      className={`${baseClass}__button provider--${provider}`}
      onClick={handleClick}
      disabled={disabled}
      iconPosition="left"
      icon={Icon ? <Icon className={`${baseClass}__icon`} /> : undefined}
      tooltip={showIconOnly ? `Sign in with ${providerName}` : undefined}
    >
      {!showIconOnly && <span>{providerName}</span>}
    </Button>
  );
}

export function AlternativeMethods() {
  const { alternativeMethods, hasMethod, isSignup, showIconOnly } = useLoginForm();
  // One shared in-flight flag: only one auth flow at a time, and every button is disabled meanwhile
  const [pending, setPending] = useState<string | null>(null);

  if (alternativeMethods.length === 0) return null;

  const run = async (method: string, task: () => Promise<void>) => {
    setPending(method);
    try {
      await task();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to sign in with ${method}`));
    } finally {
      setPending(null);
    }
  };

  const shared = { disabled: pending !== null, pending, run };

  return (
    <>
      {hasMethod('emailPassword') && (
        <div className={`${baseClass}__divider`}>
          <span>Or {isSignup ? 'sign up' : 'login'} with</span>
        </div>
      )}
      <div
        className={`${baseClass} ${baseClass}--count-${showIconOnly ? 'many' : alternativeMethods.length}`}
      >
        {/* passkey / magicLink are already filtered out for signup in the provider */}
        {alternativeMethods.map((method) => {
          if (method === 'passkey') return <PasskeyButton key={method} {...shared} />;
          if (method === 'magicLink') return <MagicLinkButton key={method} {...shared} />;
          if (isSocialProvider(method)) {
            return <SocialButton key={method} provider={method} {...shared} />;
          }
          return null;
        })}
      </div>
    </>
  );
}
