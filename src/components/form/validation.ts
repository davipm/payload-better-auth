import { z } from 'zod';
import { emailRegex, usernameRegex } from '../../utils/regex.js';
import type { LoginType } from '../login-form/context.js';

/** Minimal translation function type. Payload's `t` is keyed to its own translation keys. */
export type Translate = (...args: any[]) => string;

export interface UsernameSettings {
  minLength: number;
  maxLength: number;
}

// Keep in sync with the better-auth username plugin options (as far as I know its own defaults are 3–30)
export const DEFAULT_USERNAME_SETTINGS: UsernameSettings = { minLength: 5, maxLength: 128 };

// ---------------------------------------------------------------------------
// Plain validators
// ---------------------------------------------------------------------------

export const isValidEmail = (val: string) => emailRegex.test(val);

export const isValidUsername = (
  val: string,
  {
    minLength = DEFAULT_USERNAME_SETTINGS.minLength,
    maxLength = DEFAULT_USERNAME_SETTINGS.maxLength,
  }: Partial<UsernameSettings> = {},
) => val.length >= minLength && val.length <= maxLength && usernameRegex.test(val);

// ---------------------------------------------------------------------------
// Field builders
// ---------------------------------------------------------------------------

/** Trimmed string: empty → "required" (only if required), otherwise must satisfy `isValid`. */
const validatedString = ({
  t,
  required,
  isValid,
  invalidKey,
}: {
  t: Translate;
  required: boolean;
  isValid: (val: string) => boolean;
  invalidKey: string;
}) =>
  z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      if (!val) {
        if (required) ctx.addIssue({ code: 'custom', message: t('validation:required') });
        return; // an optional field may be empty
      }
      if (!isValid(val)) ctx.addIssue({ code: 'custom', message: t(invalidKey) });
    });

export const emailField = ({ t, required = true }: { t: Translate; required?: boolean }) =>
  validatedString({
    t,
    required,
    isValid: isValidEmail,
    invalidKey: 'authentication:emailNotValid',
  });

export const usernameField = ({
  t,
  required = true,
  ...settings
}: { t: Translate; required?: boolean } & Partial<UsernameSettings>) =>
  validatedString({
    t,
    required,
    isValid: (val) => isValidUsername(val, settings),
    invalidKey: 'authentication:usernameNotValid',
  });

/** Not trimmed on purpose. `minLength` only matters at signup/reset, never at login. */
export const passwordField = ({
  t,
  required = true,
  minLength = 1,
}: {
  t: Translate;
  required?: boolean;
  minLength?: number;
}) =>
  z.string().superRefine((val, ctx) => {
    if (!val) {
      if (required) ctx.addIssue({ code: 'custom', message: t('validation:required') });
      return;
    }
    if (val.length < minLength) {
      ctx.addIssue({ code: 'custom', message: t('validation:shorterThanMin', { minLength }) });
    }
  });

export const confirmPasswordField = ({
  t,
  required = true,
}: {
  t: Translate;
  required?: boolean;
}) => passwordField({ t, required });

export const otpField = ({
  digits = 6,
  message = `Code must be ${digits} digits`,
}: {
  digits?: number;
  message?: string;
} = {}) => z.string().regex(new RegExp(`^\\d{${digits}}$`), message);

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

export const passwordWithConfirmation = ({
  t,
  minLength = 1,
}: {
  t: Translate;
  minLength?: number;
}) =>
  z
    .object({
      password: passwordField({ t, minLength }),
      confirmPassword: confirmPasswordField({ t }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('fields:passwordsDoNotMatch'),
    });

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

export const createLoginSchema = ({
  t,
  loginType,
  usernameSettings = DEFAULT_USERNAME_SETTINGS,
}: {
  t: Translate;
  loginType: LoginType;
  usernameSettings?: UsernameSettings;
}) =>
  z.object({
    login: z
      .string({ message: t('validation:required') })
      .trim()
      .superRefine((val, ctx) => {
        if (!val) {
          ctx.addIssue({ code: 'custom', message: t('validation:required') });
          return;
        }

        const emailOk = isValidEmail(val);
        const usernameOk = isValidUsername(val, usernameSettings);
        const valid =
          loginType === 'email'
            ? emailOk
            : loginType === 'username'
              ? usernameOk
              : emailOk || usernameOk;
        if (valid) return;

        // emailOrUsername: report against whichever the input looks like
        const looksLikeEmail =
          loginType === 'email' || (loginType === 'emailOrUsername' && val.includes('@'));
        ctx.addIssue({
          code: 'custom',
          message: t(
            looksLikeEmail ? 'authentication:emailNotValid' : 'authentication:usernameNotValid',
          ),
        });
      }),
    password: passwordField({ t }),
  });

export const createSignupSchema = ({
  t,
  requireUsername = false,
  requireConfirmPassword = false,
  minPasswordLength = 1,
  usernameSettings = DEFAULT_USERNAME_SETTINGS,
}: {
  t: Translate;
  requireUsername?: boolean;
  requireConfirmPassword?: boolean;
  /** Mirror better-auth's `emailAndPassword.minPasswordLength` (default 8) */
  minPasswordLength?: number;
  usernameSettings?: UsernameSettings;
}) =>
  z
    .object({
      name: z
        .string({ message: t('validation:required') })
        .trim()
        .min(1, t('validation:required')),
      email: emailField({ t }),
      username: usernameField({ t, required: requireUsername, ...usernameSettings }).optional(),
      password: passwordField({ t, minLength: minPasswordLength }),
      confirmPassword: confirmPasswordField({ t, required: requireConfirmPassword }).optional(),
    })
    // one return type for both modes
    .refine((data) => !requireConfirmPassword || data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('fields:passwordsDoNotMatch'),
    });

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
export type SignupValues = z.infer<ReturnType<typeof createSignupSchema>>;
