import { supportedBAPluginIds } from '../plugin/constants.js';
import { checkPluginExists } from './plugin/check-plugin-exists.js';

export const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getLoginPlugins = (baOptions: Parameters<typeof checkPluginExists>[0]) => ({
  username: checkPluginExists(baOptions, supportedBAPluginIds.username),
  passkey: checkPluginExists(baOptions, supportedBAPluginIds.passkey),
  magicLink: checkPluginExists(baOptions, supportedBAPluginIds.magicLink),
});

export function resolveLoginIdentifiers(
  hasUsernamePlugin: boolean,
  loginWithUsername?: boolean | { allowEmailLogin?: boolean },
): ('email' | 'username')[] {
  if (!hasUsernamePlugin || !loginWithUsername) return ['email'];
  if (typeof loginWithUsername === 'object' && loginWithUsername.allowEmailLogin === false) {
    return ['username'];
  }
  return ['email', 'username'];
}
