'use client';

import './index.css';

import { Button, CopyIcon, type TextField, toast, useField } from '@payloadcms/ui';
import { useEffect, useRef, useState } from 'react';

export const FieldCopyButton: typeof TextField = ({ path }) => {
  const { value } = useField<string>({ path });
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error('Failed to copy to clipboard');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current); // restart the countdown on rapid clicks
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="field-copy-text__button-wrapper">
      <div className="field-copy-text__tooltip" data-visible={copied} aria-hidden="true">
        Copied
      </div>
      <span className="field-copy-text__sr" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </span>
      <Button
        type="button"
        icon={<CopyIcon />}
        buttonStyle="ghost"
        onClick={() => void handleCopy()}
        className="field-copy-text__button"
        aria-label="Copy to clipboard"
        disabled={!value}
      />
    </div>
  );
};
