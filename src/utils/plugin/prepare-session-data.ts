import type { CollectionConfig } from 'payload';
import { getFieldsToSign } from 'payload';
import type { Session, User } from '../../types/generated-types.js';

export async function prepareUser({
  user,
  userCollection,
}: {
  user: User & Record<string, any>;
  userCollection: CollectionConfig;
}) {
  const newUser = getFieldsToSign({
    collectionConfig: userCollection,
    email: user.email,
    user: {
      ...user,
      id: user.id,
      collection: userCollection.slug,
    },
  });

  return newUser as User & Record<string, any>;
}

export async function prepareSession({
  session,
  sessionCollection,
}: {
  session: Session & Record<string, any>;
  sessionCollection: CollectionConfig;
}) {
  const filteredSession = getFieldsToSign({
    collectionConfig: sessionCollection,
    email: '',
    user: {
      ...session,
      id: session.id,
      collection: sessionCollection.slug,
    },
  });

  delete filteredSession.email;
  delete filteredSession.collection;
  Object.assign(filteredSession, {
    userId: session.userId,
  });

  return filteredSession as Session & Record<string, any>;
}

/**
 * Prepares session data for cookie cache by filtering user and session objects
 * based on the payload configuration's 'saveToJwt' property
 */
export async function prepareSessionData({
  sessionData,
  usersCollection,
  sessionsCollection,
}: {
  sessionData: {
    session: Session & Record<string, any>;
    user: User & Record<string, any>;
  };
  usersCollection: CollectionConfig;
  sessionsCollection: CollectionConfig;
}) {
  if (!sessionData?.user) return null;

  const newUser = await prepareUser({
    user: sessionData.user,
    userCollection: usersCollection,
  });
  const newSession = await prepareSession({
    session: sessionData.session,
    sessionCollection: sessionsCollection,
  });

  return {
    session: newSession,
    user: newUser,
  };
}
