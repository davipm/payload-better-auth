import type { LoginMethod, PayloadAuthOptions } from '../../types/plugin.js';
import { checkPluginExists } from '../../utils/plugin/check-plugin-exists.js';
import { supportedBAPluginIds } from '../constants.js';

export function setLoginMethods({ pluginOptions }: { pluginOptions: PayloadAuthOptions }) {
  const betterAuthOptions = pluginOptions.betterAuthOptions ?? {};
  if (pluginOptions?.admin?.loginMethods) return pluginOptions; // If user defined, exit early
  const loginMethods = Object.keys(betterAuthOptions?.socialProviders ?? {});
  if (betterAuthOptions?.emailAndPassword?.enabled) loginMethods.push('emailPassword');
  if (checkPluginExists(betterAuthOptions, supportedBAPluginIds.passkey))
    loginMethods.push('passkey');
  pluginOptions.admin = pluginOptions.admin ?? {};
  pluginOptions.admin.loginMethods = loginMethods as LoginMethod[];
  return pluginOptions;
}
