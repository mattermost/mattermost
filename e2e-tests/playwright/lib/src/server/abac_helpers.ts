// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {getRandomId} from '../util';

/**
 * Create a user with custom profile attributes
 * IMPORTANT: This creates the user first, then sets attributes by field ID
 */
export async function createUserWithAttributes(
    client: Client4,
    attributes: Record<string, string>,
): Promise<UserProfile> {
    const randomId = await getRandomId();
    // Ensure username starts with a letter (Mattermost requirement)
    const username = `user${randomId}`.toLowerCase();

    // Create user without attributes first
    const user = await client.createUser(
        {
            email: `${username}@example.com`,
            username: username,
            password: 'Password123!',
        } as any,
        '',
        '',
    );

    // Set attributes using field IDs (if any provided)
    if (Object.keys(attributes).length > 0) {
        const fields = await client.getCustomProfileAttributeFields();

        // Convert attribute names to field IDs
        const valuesByFieldId: Record<string, string> = {};
        for (const [attrName, attrValue] of Object.entries(attributes)) {
            const field = fields.find((f: any) => f.name === attrName);
            if (field) {
                valuesByFieldId[field.id] = attrValue;
            } else {
                throw new Error(
                    `Attribute field "${attrName}" not found. Available fields: ${fields.map((f: any) => f.name).join(', ')}`,
                );
            }
        }

        // Set the attribute values
        if (Object.keys(valuesByFieldId).length > 0) {
            await client.updateUserCustomProfileAttributesValues(user.id, valuesByFieldId);
        }
    }

    return user;
}

/**
 * Enable ABAC in System Console
 */
export async function enableABAC(page: Page): Promise<void> {
    const enableRadio = page.locator('#AccessControlSettings\\.EnableAttributeBasedAccessControltrue');
    await enableRadio.click();

    // Wait for Save button to become enabled (indicates change detected)
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.waitFor({state: 'visible', timeout: 5000});

    // Check if already enabled (button stays disabled if no change needed)
    const isDisabled = await saveButton.isDisabled();
    if (isDisabled) {
        return;
    }

    await saveButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Disable ABAC in System Console
 */
export async function disableABAC(page: Page): Promise<void> {
    const disableRadio = page.locator('#AccessControlSettings\\.EnableAttributeBasedAccessControlfalse');
    await disableRadio.click();

    // Wait for Save button to become enabled (indicates change detected)
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.waitFor({state: 'visible', timeout: 5000});

    // Check if already disabled (button stays disabled if no change needed)
    const isDisabled = await saveButton.isDisabled();
    if (isDisabled) {
        return;
    }

    await saveButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate to ABAC page in System Console
 */
export async function navigateToABACPage(page: Page): Promise<void> {
    await page.goto('/admin_console/system_attributes/attribute_based_access_control');
    await page.waitForLoadState('networkidle');
}

/**
 * Create a basic policy using Table Editor (Basic mode)
 */
export async function createBasicPolicy(
    page: Page,
    options: {
        name: string;
        attribute: string;
        operator: string;
        value: string;
        autoSync?: boolean;
        channels?: string[];
    },
): Promise<void> {
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.fill(options.name);

    // Set auto-sync if specified
    if (options.autoSync) {
        const autoSyncToggle = page
            .locator('input[type="checkbox"]')
            .filter({hasText: /auto|sync/i})
            .first();
        if (await autoSyncToggle.isVisible({timeout: 1000})) {
            await autoSyncToggle.check();
        }
    }

    // Set policy expression using table editor
    const attributeDropdown = page.locator('select').first();
    const operatorDropdown = page.locator('select').nth(1);
    const valueInput = page.locator('input[type="text"]').last();

    await attributeDropdown.selectOption(options.attribute);
    await operatorDropdown.selectOption(options.operator);
    await valueInput.fill(options.value);

    // Add channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add.*channel/i});
        if (await addChannelsButton.isVisible({timeout: 1000})) {
            await addChannelsButton.click();

            const channelModal = page.locator('.modal, [role="dialog"]').first();
            for (const channelName of options.channels) {
                await channelModal.getByText(channelName, {exact: false}).click();
            }

            const modalSaveButton = channelModal.getByRole('button', {name: 'Save'});
            await modalSaveButton.click();
        }
    }

    // Save policy
    const saveButton = page.getByRole('button', {name: 'Save'}).last();
    await saveButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Create an advanced policy using CEL Editor (Advanced mode)
 */
export async function createAdvancedPolicy(
    page: Page,
    options: {
        name: string;
        celExpression: string;
        autoSync?: boolean;
        channels?: string[];
    },
): Promise<void> {
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.fill(options.name);

    // Set auto-sync if specified
    if (options.autoSync) {
        const autoSyncToggle = page
            .locator('input[type="checkbox"]')
            .filter({hasText: /auto|sync/i})
            .first();
        if (await autoSyncToggle.isVisible({timeout: 1000})) {
            await autoSyncToggle.check();
        }
    }

    // Switch to Advanced mode
    const modeToggle = page.getByRole('button', {name: /advanced|basic/i});
    if (await modeToggle.isVisible({timeout: 1000})) {
        await modeToggle.click();
        await page.waitForTimeout(500);
    }

    // Fill CEL expression
    const celEditor = page.locator('textarea').first();
    await celEditor.fill(options.celExpression);

    // Add channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add.*channel/i});
        if (await addChannelsButton.isVisible({timeout: 1000})) {
            await addChannelsButton.click();

            const channelModal = page.locator('.modal, [role="dialog"]').first();
            for (const channelName of options.channels) {
                await channelModal.getByText(channelName, {exact: false}).click();
            }

            const modalSaveButton = channelModal.getByRole('button', {name: 'Save'});
            await modalSaveButton.click();
        }
    }

    // Save policy
    const saveButton = page.getByRole('button', {name: 'Save'}).last();
    await saveButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Edit an existing policy
 */
export async function editPolicy(page: Page, policyName: string): Promise<void> {
    const policyRow = page.locator('.policy-name').filter({hasText: policyName}).locator('..').locator('..');
    const menuButton = policyRow.locator('button[id*="policy-menu"]');
    await menuButton.click();

    const editButton = page.getByRole('menuitem', {name: 'Edit'});
    await editButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Delete a policy
 */
export async function deletePolicy(page: Page, policyName: string): Promise<void> {
    const policyRow = page.locator('.policy-name').filter({hasText: policyName}).locator('..').locator('..');
    const menuButton = policyRow.locator('button[id*="policy-menu"]');
    await menuButton.click();

    const deleteButton = page.getByRole('menuitem', {name: 'Delete'});
    await deleteButton.click();

    // Confirm deletion if modal appears
    const confirmButton = page.getByRole('button', {name: /delete|confirm/i});
    if (await confirmButton.isVisible({timeout: 1000})) {
        await confirmButton.click();
    }

    await page.waitForLoadState('networkidle');
}

/**
 * Run ABAC sync job
 */
export async function runSyncJob(page: Page, waitForCompletion: boolean = true): Promise<void> {
    const runSyncButton = page.getByRole('button', {name: 'Run Sync Job'});
    await runSyncButton.click();
    await page.waitForLoadState('networkidle');

    // Wait for job to process if requested
    if (waitForCompletion) {
        await page.waitForTimeout(3000);
    }
}

/**
 * Verify user is member of channel
 */
export async function verifyUserInChannel(client: Client4, userId: string, channelId: string): Promise<boolean> {
    try {
        const members = await client.getChannelMembers(channelId);
        return members.some((m: any) => m.user_id === userId);
    } catch {
        return false;
    }
}

/**
 * Verify user is NOT member of channel
 */
export async function verifyUserNotInChannel(client: Client4, userId: string, channelId: string): Promise<boolean> {
    return !(await verifyUserInChannel(client, userId, channelId));
}

/**
 * Update user's custom profile attributes
 * Converts attribute names to field IDs and uses the correct API
 */
export async function updateUserAttributes(
    client: Client4,
    userId: string,
    attributes: Record<string, string>,
): Promise<void> {
    const fields = await client.getCustomProfileAttributeFields();

    // Convert attribute names to field IDs
    const valuesByFieldId: Record<string, string> = {};
    for (const [attrName, attrValue] of Object.entries(attributes)) {
        const field = fields.find((f: any) => f.name === attrName);
        if (field) {
            valuesByFieldId[field.id] = attrValue;
        } else {
            throw new Error(
                `Attribute field "${attrName}" not found. Available fields: ${fields.map((f: any) => f.name).join(', ')}`,
            );
        }
    }

    // Update attributes using field IDs
    if (Object.keys(valuesByFieldId).length > 0) {
        await client.updateUserCustomProfileAttributesValues(userId, valuesByFieldId);
    }
}
