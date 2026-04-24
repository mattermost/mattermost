// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {type PlaywrightExtended, type SystemConsolePage} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

export type FieldsMap = Record<string, UserPropertyField>;

export interface TestContext {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
}

/**
 * Ensure license, wipe any pre-existing CPA fields so the suite starts with a
 * clean slate, log in as admin and open the System Console home page.
 * Shared by the user_attributes_* specs.
 */
export async function setupTest(pw: PlaywrightExtended): Promise<TestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();

    // # Clean up any pre-existing CPA fields to start with a blank slate
    try {
        const existing = await adminClient.getCustomProfileAttributeFields();
        if (existing?.length) {
            const existingMap: FieldsMap = {};
            for (const f of existing) {
                existingMap[f.id] = f;
            }
            await deleteCustomProfileAttributes(adminClient, existingMap);
        }
    } catch {
        // No fields to clean up
    }

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage};
}

/**
 * Fetch all current CPA fields and return them indexed by id.
 * Shared by the user_attributes_* specs.
 */
export async function getFieldsMap(client: Client4): Promise<FieldsMap> {
    const fields: UserPropertyField[] = await client.getCustomProfileAttributeFields();
    const map: FieldsMap = {};
    for (const field of fields) {
        map[field.id] = field;
    }
    return map;
}

/**
 * Delete any fields referenced in the provided map.
 * Shared by the user_attributes_* specs.
 */
export async function cleanupFields(client: Client4, fieldsMap: FieldsMap): Promise<void> {
    if (Object.keys(fieldsMap).length > 0) {
        await deleteCustomProfileAttributes(client, fieldsMap);
    }
}
