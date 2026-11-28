'use client';

import { Button, useTranslation } from '@payloadcms/ui';
import { useMemo } from 'react';
import type { PasskeyWithId } from '../../types/passkeys.js';
import { Fingerprint, Trash } from '../icons.js';

interface PasskeyListProps {
  passkeys: PasskeyWithId[];
  deletingId?: string | null;
  onDelete?: (passkey: PasskeyWithId) => void;
}

// Payload language codes aren't always valid BCP-47 tags (e.g. 'zhTw'), and Intl throws on those
const makeDateFormatter = (locale: string) => {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
};

export function PasskeyList({ passkeys, deletingId = null, onDelete }: PasskeyListProps) {
  const { i18n } = useTranslation();
  const formatter = useMemo(() => makeDateFormatter(i18n.language), [i18n.language]);

  if (passkeys.length === 0) return <p className="passkeys-field__empty">No passkeys found.</p>;

  return (
    <ul className="passkeys-field__list">
      {passkeys.map((passkey) => {
        const { id, createdAt } = passkey;
        const name = passkey.name || 'My Passkey';
        return (
          <li key={id} className="passkeys-field__list-item">
            <Fingerprint aria-hidden="true" />
            <span>{name}</span>
            {createdAt && (
              <time className="passkeys-field__list-item-date" suppressHydrationWarning>
                {formatter.format(new Date(createdAt))}
              </time>
            )}
            {onDelete && (
              <Button
                type="button"
                buttonStyle="ghost"
                size="medium"
                className="passkeys-field__delete-button"
                onClick={() => onDelete(passkey)}
                disabled={deletingId === id}
                aria-label={`Delete passkey ${name}`}
              >
                <Trash aria-hidden="true" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
