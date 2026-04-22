/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import {
  AuthType,
  type Config,
  loadApiKey,
  loadDeepSeekApiKey,
  debugLogger,
  isAccountSuspendedError,
  ProjectIdRequiredError,
} from '@google/gemini-cli-core';
import { getErrorMessage } from '@google/gemini-cli-core';
import { AuthState } from '../types.js';
import { validateAuthMethod } from '../../config/auth.js';

export function validateAuthMethodWithSettings(
  authType: AuthType,
  settings: LoadedSettings,
): string | null {
  const enforcedType = settings.merged.security.auth.enforcedType;
  if (enforcedType && enforcedType !== authType) {
    return `Authentication is enforced to be ${enforcedType}, but you are currently using ${authType}.`;
  }
  if (settings.merged.security.auth.useExternal) {
    return null;
  }
  // If using Gemini or DeepSeek API key, we don't validate here — key may be in keychain.
  if (authType === AuthType.USE_GEMINI || authType === AuthType.USE_DEEPSEEK) {
    return null;
  }
  return validateAuthMethod(authType);
}

import type { AccountSuspensionInfo } from '../contexts/UIStateContext.js';

export const useAuthCommand = (
  settings: LoadedSettings,
  config: Config,
  initialAuthError: string | null = null,
  initialAccountSuspensionInfo: AccountSuspensionInfo | null = null,
) => {
  const [authState, setAuthState] = useState<AuthState>(
    initialAuthError ? AuthState.Updating : AuthState.Unauthenticated,
  );

  const [authError, setAuthError] = useState<string | null>(initialAuthError);
  const [accountSuspensionInfo, setAccountSuspensionInfo] =
    useState<AccountSuspensionInfo | null>(initialAccountSuspensionInfo);
  const [apiKeyDefaultValue, setApiKeyDefaultValue] = useState<
    string | undefined
  >(undefined);
  const [pendingAuthType, setPendingAuthType] = useState<AuthType | undefined>(
    undefined,
  );

  const onAuthError = useCallback(
    (error: string | null) => {
      setAuthError(error);
      if (error) {
        setAuthState(AuthState.Updating);
      }
    },
    [setAuthError, setAuthState],
  );

  const reloadApiKey = useCallback(
    async (authType?: AuthType) => {
      const resolvedType = authType ?? pendingAuthType;
      if (resolvedType === AuthType.USE_DEEPSEEK) {
        const envKey = process.env['DEEPSEEK_API_KEY'];
        if (envKey) {
          setApiKeyDefaultValue(envKey);
          return envKey;
        }
        const storedKey = (await loadDeepSeekApiKey()) ?? '';
        setApiKeyDefaultValue(storedKey);
        return storedKey;
      }
      const envKey = process.env['GEMINI_API_KEY'];
      if (envKey !== undefined) {
        setApiKeyDefaultValue(envKey);
        return envKey;
      }
      const storedKey = (await loadApiKey()) ?? '';
      setApiKeyDefaultValue(storedKey);
      return storedKey;
    },
    [pendingAuthType],
  );

  useEffect(() => {
    if (authState === AuthState.AwaitingApiKeyInput) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      reloadApiKey();
    }
  }, [authState, reloadApiKey]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      if (authState !== AuthState.Unauthenticated) {
        return;
      }

      const savedAuthType = settings.merged.security.auth.selectedType;
      const authType = process.env['DEEPSEEK_API_KEY']
        ? AuthType.USE_DEEPSEEK
        : savedAuthType === AuthType.USE_DEEPSEEK
          ? AuthType.USE_DEEPSEEK
          : undefined;
      if (!authType) {
        onAuthError('No authentication method selected.');
        return;
      }

      if (authType === AuthType.USE_DEEPSEEK) {
        const key = await reloadApiKey(authType);
        if (!key) {
          setPendingAuthType(authType);
          setAuthState(AuthState.AwaitingApiKeyInput);
          return;
        }
      }

      const error = validateAuthMethodWithSettings(authType, settings);
      if (error) {
        onAuthError(error);
        return;
      }

      const defaultAuthType = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
      if (
        defaultAuthType &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        !Object.values(AuthType).includes(defaultAuthType as AuthType)
      ) {
        onAuthError(
          `Invalid value for GEMINI_DEFAULT_AUTH_TYPE: "${defaultAuthType}". ` +
            `Valid values are: ${Object.values(AuthType).join(', ')}.`,
        );
        return;
      }

      try {
        await config.refreshAuth(authType);

        debugLogger.log(`Authenticated via "${authType}".`);
        setAuthError(null);
        setAuthState(AuthState.Authenticated);
      } catch (e) {
        const suspendedError = isAccountSuspendedError(e);
        if (suspendedError) {
          setAccountSuspensionInfo({
            message: suspendedError.message,
            appealUrl: suspendedError.appealUrl,
            appealLinkText: suspendedError.appealLinkText,
          });
        } else if (e instanceof ProjectIdRequiredError) {
          // OAuth succeeded but account setup requires project ID
          // Show the error message directly without "Failed to login" prefix
          onAuthError(getErrorMessage(e));
        } else {
          onAuthError(`Failed to sign in. Message: ${getErrorMessage(e)}`);
        }
      }
    })();
  }, [
    settings,
    config,
    authState,
    setAuthState,
    setAuthError,
    onAuthError,
    reloadApiKey,
  ]);

  return {
    authState,
    setAuthState,
    authError,
    onAuthError,
    apiKeyDefaultValue,
    reloadApiKey,
    pendingAuthType,
    setPendingAuthType,
    accountSuspensionInfo,
    setAccountSuspensionInfo,
  };
};
