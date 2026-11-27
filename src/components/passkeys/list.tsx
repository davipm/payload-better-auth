'use client';

import { Button } from '@payloadcms/ui';
import type { PasskeyWithId } from '../../types/passkeys.js';
import { Fingerprint, Trash } from '../icons.js';

interface PasskeyListProps {
  passkeys: PasskeyWithId[];
  onDelete?: (id: string) => void;
}

export function PasskeyList({ passkeys, onDelete }: PasskeyListProps) {
  if (passkeys.length === 0) return <p style={{ marginBottom: '1rem' }}>No passkeys found.</p>;

  return (
    <ul className="passkeys-field__list">
      {passkeys.map((pk) => {
        const { id, createdAt } = pk;
        if (!id || !createdAt) return null;
        return (
          <li key={id} className="passkeys-field__list-item">
            <Fingerprint />
            <span>{pk.name || 'My Passkey'}</span>
            <span className="passkeys-field__list-item-date"> - </span>
            <span className="passkeys-field__list-item-date">
              {new Date(createdAt).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
            {onDelete && (
              <Button
                buttonStyle="ghost"
                size="medium"
                className="passkeys-field__delete-button"
                onClick={() => onDelete(id)}
              >
                <Trash />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
