'use client';

import './index.css';

import { Button, type TextField, useField } from '@payloadcms/ui';

export const GenerateUuidButton: typeof TextField = ({ path, readOnly }) => {
  const { setValue } = useField<string>({ path });

  return (
    <div className="generate-uuid-button-wrapper">
      <Button
        type="button"
        buttonStyle="primary"
        onClick={() => setValue(crypto.randomUUID())}
        className="generate-uuid-button"
        disabled={readOnly}
      >
        Generate UUID
      </Button>
    </div>
  );
};
