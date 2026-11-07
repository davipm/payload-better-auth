export const isBrowser = typeof window !== 'undefined';

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const getServerSideURL = (): string => {
  const { NEXT_PUBLIC_SERVER_URL } = process.env;

  if (NEXT_PUBLIC_SERVER_URL) return stripTrailingSlash(NEXT_PUBLIC_SERVER_URL);

  return 'http://localhost:3000';
};

export const getClientSideURL = (): string =>
  isBrowser ? window.location.origin : getServerSideURL();
