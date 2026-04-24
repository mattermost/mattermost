// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {enableAutotranslationConfig, hasAutotranslationLicense, test} from '@mattermost/playwright-lib';

export const DEFAULT_TARGET_LANGUAGES = ['en', 'es'] as const;

export function getTranslationServiceUrl() {
    return process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
}

export async function skipIfNoAutotranslationLicense(adminClient: Client4) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(
        !hasAutotranslationLicense(license.SkuShortName),
        'Skipping test - server does not have Entry or Advanced license',
    );
}

export async function setupAutotranslationConfig(adminClient: Client4, translationUrl?: string) {
    const url = translationUrl ?? getTranslationServiceUrl();
    await enableAutotranslationConfig(adminClient, {
        mockBaseUrl: url,
        targetLanguages: [...DEFAULT_TARGET_LANGUAGES],
    });
    return url;
}
