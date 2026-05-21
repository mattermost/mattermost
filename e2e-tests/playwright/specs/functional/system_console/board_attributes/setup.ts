// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {SystemConsolePage} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export const BOARDS_GROUP = 'boards';
export const OBJECT_TYPE_POST = 'post';
export const SYSTEM_TARGET_TYPE = 'system';

export type BoardAttributeType = 'Text' | 'Select' | 'Multi-select' | 'Date' | 'User';

export type ColorTokenName = 'Default' | 'Brown' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Purple' | 'Pink' | 'Red';

export const COLOR_TOKEN_NAMES: ColorTokenName[] = [
    'Default',
    'Brown',
    'Orange',
    'Yellow',
    'Green',
    'Blue',
    'Purple',
    'Pink',
    'Red',
];

// Server-side color tokens map to the UI labels above. The hex/wire token is
// the lowercase form except 'default' which doubles as the fallback.
export const SERVER_COLOR_BY_UI_LABEL: Record<ColorTokenName, string> = {
    Default: 'default',
    Brown: 'brown',
    Orange: 'orange',
    Yellow: 'yellow',
    Green: 'green',
    Blue: 'blue',
    Purple: 'purple',
    Pink: 'pink',
    Red: 'red',
};

export type BoardAttributesTestContext = {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
};

let cachedAdminClient: Client4 | null = null;

export async function setupBoardAttributesTest(pw: PlaywrightExtended): Promise<BoardAttributesTestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Feature flags are read at server start from MM_FEATUREFLAGS_* env,
    // not from runtime config patches — CI sets it in server.generate.sh;
    // locally, export it before running the server.
    await pw.skipIfFeatureFlagNotSet('IntegratedBoards', true);

    const {adminUser, adminClient} = await pw.initSetup();
    cachedAdminClient = adminClient;

    await deleteNonProtectedFields(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage};
}

export async function cleanupCustomBoardFields(): Promise<void> {
    if (!cachedAdminClient) {
        return;
    }
    try {
        await deleteNonProtectedFields(cachedAdminClient);
    } catch {
        // best-effort
    }
}

async function deleteNonProtectedFields(adminClient: Client4): Promise<void> {
    try {
        const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
        for (const field of fields ?? []) {
            if (!field.protected) {
                await adminClient.deletePropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, field.id);
            }
        }
    } catch {
        // Boards group not yet seeded — first board creation will trigger
        // doSetupBoardsProperties.
    }
}
