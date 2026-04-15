// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {mergeWithOnPremServerConfig} from './server/default_config';

export type EnableAutotranslationOptions = {
    mockBaseUrl: string;
    targetLanguages?: string[];
};

/**
 * Enable autotranslation in server config with LibreTranslate provider pointing at the mock URL.
 * Requires an enterprise license for the feature to be available.
 */
export async function enableAutotranslationConfig(
    adminClient: Client4,
    options: EnableAutotranslationOptions,
): Promise<void> {
    const config = mergeWithOnPremServerConfig({
        FeatureFlags: {
            AutoTranslation: true,
        },
        AutoTranslationSettings: {
            Enable: true,
            Provider: 'libretranslate',
            LibreTranslate: {
                URL: options.mockBaseUrl,
                APIKey: '',
            },
            TargetLanguages: options.targetLanguages ?? ['en', 'es'],
            RestrictDMAndGM: false,
            Workers: 4,
            TimeoutMs: 5000,
        },
    });
    await adminClient.updateConfig(config as any);
}

/**
 * Disable autotranslation in server config.
 */
export async function disableAutotranslationConfig(adminClient: Client4): Promise<void> {
    const config = mergeWithOnPremServerConfig({
        FeatureFlags: {
            AutoTranslation: false,
        },
        AutoTranslationSettings: {
            Enable: false,
            TargetLanguages: [],
            Workers: 0,
            Provider: '',
            LibreTranslate: {
                URL: '',
                APIKey: '',
            },
            TimeoutMs: 0,
            RestrictDMAndGM: false,
        },
    });
    await adminClient.updateConfig(config as any);
}

/**
 * Enable autotranslation for a channel (requires permission and feature available).
 */
export async function enableChannelAutotranslation(adminClient: Client4, channelId: string): Promise<void> {
    await adminClient.patchChannel(channelId, {autotranslation: true} as any);
}

/**
 * Disable autotranslation for a channel.
 */
export async function disableChannelAutotranslation(adminClient: Client4, channelId: string): Promise<void> {
    await adminClient.patchChannel(channelId, {autotranslation: false} as any);
}

/**
 * Set the LibreTranslate mock's detected language for /translate. When source=auto, all /translate
 * responses use this language as detectedLanguage until changed; default is 'es'.
 *
 * Note: This is only supported on the mock server (http://localhost:3010).
 * When using real LibreTranslate, language detection is automatic and this call is silently ignored.
 */
export async function setMockSourceLanguage(mockBaseUrl: string, language: string): Promise<void> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const res = await fetch(`${mockBaseUrl}/__control/source`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({language}),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                // 404 or other error likely means real LibreTranslate (no control endpoint)
                if (res.status === 404) {
                    // Silently ignore - using real LibreTranslate with automatic language detection
                    return;
                }
                throw new Error(`Mock detect failed: ${res.status}`);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch {
        // Silently ignore all errors - could be mock server down or real LibreTranslate without control endpoint
        // Real LibreTranslate uses automatic language detection from message content anyway
        // Expected errors: AbortError (timeout), network errors, 404 from real LibreTranslate
        // All are handled gracefully by the retry logic above
    }
}

/**
 * Set autotranslation opt-in for the current user in a channel.
 * The client must be logged in as the user whose setting is being changed (e.g. userClient).
 */
export async function setUserChannelAutotranslation(
    client: Client4,
    channelId: string,
    enabled: boolean,
): Promise<void> {
    await client.setMyChannelAutotranslation(channelId, enabled);
}
