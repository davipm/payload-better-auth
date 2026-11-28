import type { PasskeysServerComponentProps, PasskeyWithId } from '../../types/passkeys.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { PasskeysClient } from './client.js';
import './index.css';

export async function Passkeys({
  id,
  passkeySlug,
  passkeyUserIdFieldName,
  payload,
  req,
  user,
  pluginOptions,
}: PasskeysServerComponentProps) {
  if (!id || !passkeySlug || !passkeyUserIdFieldName) return null;

  const { docs } = (await payload.find({
    collection: passkeySlug,
    overrideAccess: false,
    where: { [passkeyUserIdFieldName]: { equals: id } },
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    req,
  })) as unknown as { docs: PasskeyWithId[] };

  const { baseURL, basePath } = pluginOptions.betterAuthOptions ?? {};

  return (
    <div className="passkeys-field">
      <h3 className="passkeys-field__title">Passkeys</h3>
      <PasskeysClient
        initialPasskeys={docs}
        documentId={id}
        // Resolved on the server, so the id types (string vs number) can't mismatch on the client
        canAdd={user != null && String(user.id) === String(id)}
        passkeySlug={passkeySlug}
        passkeyUserIdFieldName={passkeyUserIdFieldName}
        baseURL={resolveBaseURL(baseURL, req.headers)}
        basePath={basePath}
      />
    </div>
  );
}
