// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared ABAC test helper functions
 * These functions are used across multiple ABAC test files to reduce duplication
 */

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeValuesForUser,
} from '../../channels/custom_profile_attributes/helpers';

/**
 * Verify policy exists with better waiting and retry logic
 */
export async function verifyPolicyExists(page: Page, policyName: string): Promise<boolean> {
    // Wait for the policy list to be stable
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try multiple times with increasing waits (handle race conditions)
    for (let attempt = 0; attempt < 3; attempt++) {
        const policyElement = page.locator('.policy-name').filter({hasText: policyName});
        const isVisible = await policyElement.isVisible({timeout: 3000});

        if (isVisible) {
            return true;
        }

        // Not found, wait a bit and try again
        if (attempt < 2) {
            await page.waitForTimeout(2000);
            // Reload the page to force refresh
            await page.reload();
            await page.waitForLoadState('networkidle');
        }
    }

    return false;
}

/**
 * Verify policy does NOT exist
 */
export async function verifyPolicyNotExists(page: Page, policyName: string): Promise<boolean> {
    return !(await verifyPolicyExists(page, policyName));
}

/**
 * Create user attribute field via API
 */
export async function createUserAttributeField(client: Client4, name: string, type: string = 'text'): Promise<any> {
    const url = `${client.getBaseRoute()}/custom_profile_attributes/fields`;
    const field = {
        name: name,
        type: type,
        attrs: {
            managed: 'admin', // Admin-managed attribute
            visibility: 'when_set',
        },
    };

    const response = await (client as any).doFetch(url, {
        method: 'POST',
        body: JSON.stringify(field),
    });
    return response;
}

/**
 * Enable user-managed attributes config
 */
export async function enableUserManagedAttributes(client: Client4): Promise<void> {
    try {
        const config = await client.getConfig();
        if (config.AccessControlSettings?.EnableUserManagedAttributes !== true) {
            config.AccessControlSettings = config.AccessControlSettings || {};
            config.AccessControlSettings.EnableUserManagedAttributes = true;
            await client.updateConfig(config);
        }
    } catch {
        // console.warn('Failed to enable EnableUserManagedAttributes:', _error.message || String(_error));
    }
}

/**
 * Ensure required user attributes exist via API
 */
export async function ensureUserAttributes(client: Client4, attributeNames?: string[]): Promise<void> {
    const attributesToCreate = attributeNames || ['Department'];
    await enableUserManagedAttributes(client);

    let existingAttributes: any[] = [];
    try {
        existingAttributes = await (client as any).doFetch(
            `${client.getBaseRoute()}/custom_profile_attributes/fields`,
            {method: 'GET'},
        );
    } catch {
        // console.warn(`Failed to fetch existing attributes:`, _error.message);
    }

    for (const attrName of attributesToCreate) {
        const exists = existingAttributes.some((attr: any) => attr.name === attrName);

        if (!exists) {
            try {
                await createUserAttributeField(client, attrName);
            } catch {
                throw new Error(`Cannot proceed: Attribute "${attrName}" does not exist and could not be created`);
            }
        }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Navigate to User Attributes page and create attributes via UI
 */
export async function setupUserAttributesViaUI(page: Page, attributes: string[]): Promise<void> {
    // Navigate to System Attributes → User Attributes
    await page.goto('/admin_console/system_attributes/user_attributes');
    await page.waitForLoadState('networkidle');

    for (const attrName of attributes) {
        // Click "Add attribute" button
        const addButton = page.getByRole('button', {name: /add.*attribute/i});
        if (await addButton.isVisible({timeout: 2000})) {
            await addButton.click();
            await page.waitForTimeout(500);

            // Fill attribute name
            const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').last();
            await nameInput.fill(attrName);

            // Select type (default to Text)
            // Save attribute
            const saveButton = page.getByRole('button', {name: /save/i});
            if (await saveButton.isVisible({timeout: 1000})) {
                await saveButton.click();
                await page.waitForTimeout(500);
            }
        }
    }

    // Save the page
    const savePageButton = page.getByRole('button', {name: 'Save'}).first();
    if (await savePageButton.isVisible({timeout: 2000})) {
        await savePageButton.click();
        await page.waitForLoadState('networkidle');
    }
}

/**
 * ABAC-specific helper to create user and set attributes using proper CPA helpers
 */
export async function createUserForABAC(
    adminClient: Client4,
    attributeFieldsMap: Record<string, UserPropertyField>,
    attributes: CustomProfileAttribute[],
): Promise<UserProfile> {
    // Generate random ID and ensure username starts with letter
    const randomId = Math.random().toString(36).substring(2, 9);
    const username = `user${randomId}`.toLowerCase();

    // Create the user
    const user = await adminClient.createUser(
        {
            email: `${username}@example.com`,
            username: username,
            password: 'Password123!',
        } as any,
        '',
        '',
    );

    await setupCustomProfileAttributeValuesForUser(adminClient, attributes, attributeFieldsMap, user.id);

    return user;
}

/**
 * Test Access Rule Result interface
 */
export interface TestAccessRuleResult {
    totalMatches: number;
    matchingUsernames: string[];
    expectedUsersMatch: boolean;
    unexpectedUsersMatch: boolean;
}

/**
 * Test Access Rule Helper
 * Clicks the "Test access rule" button and verifies which users match the policy
 */
export async function testAccessRule(
    page: Page,
    options: {
        expectedMatchingUsers?: string[]; // usernames that SHOULD match
        expectedNonMatchingUsers?: string[]; // usernames that should NOT match
        searchForUser?: string; // optional: search for a specific user in the modal
    } = {},
): Promise<TestAccessRuleResult> {
    const testButton = page.locator('button').filter({hasText: 'Test access rule'});
    await testButton.waitFor({state: 'visible', timeout: 5000});
    await testButton.click();

    const modal = page.locator('[role="dialog"], .modal').filter({hasText: 'Access Rule Test Results'});
    await modal.waitFor({state: 'visible', timeout: 5000});

    await page.waitForTimeout(1000);
    let totalMatches = 0;

    const countText = await modal
        .locator('text=/\\d+.*(?:members|total|match)/i')
        .first()
        .textContent({timeout: 5000})
        .catch(() => null);

    if (countText) {
        const totalMatch = countText.match(/of\s*(\d+)\s*total/i);
        if (totalMatch) {
            totalMatches = parseInt(totalMatch[1]);
        } else {
            const matchesMatch = countText.match(/(\d+)\s*match/i);
            if (matchesMatch) {
                totalMatches = parseInt(matchesMatch[1]);
            }
        }
    }

    const matchingUsernames: string[] = [];
    const userButtons = modal.locator('.more-modal__name button, [class*="more-modal__name"] button');
    const count = await userButtons.count();

    for (let i = 0; i < count; i++) {
        const username = await userButtons.nth(i).textContent();
        if (username) {
            const cleanUsername = username.replace('@', '').trim();
            matchingUsernames.push(cleanUsername);
        }
    }

    if (options.searchForUser) {
        const searchInput = modal.locator('input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({timeout: 2000})) {
            await searchInput.fill(options.searchForUser);
            await page.waitForTimeout(500);
        }
    }

    let expectedUsersMatch = true;
    if (options.expectedMatchingUsers && options.expectedMatchingUsers.length > 0) {
        for (const expectedUser of options.expectedMatchingUsers) {
            const searchInput = modal.locator('input[placeholder*="Search" i]').first();
            if (await searchInput.isVisible({timeout: 2000})) {
                await searchInput.fill(expectedUser);
                await page.waitForTimeout(1000);

                const userInResults = modal.locator(`text=@${expectedUser}`).first();
                const isVisible = await userInResults.isVisible({timeout: 5000});

                if (!isVisible) {
                    // console.error(`✗ Expected user "${expectedUser}" NOT found in matching results`);
                    expectedUsersMatch = false;
                }

                await searchInput.fill('');
                await page.waitForTimeout(500);
            }
        }
    }

    let unexpectedUsersMatch = false;
    if (options.expectedNonMatchingUsers && options.expectedNonMatchingUsers.length > 0) {
        for (const unexpectedUser of options.expectedNonMatchingUsers) {
            const searchInput = modal.locator('input[placeholder*="Search" i]').first();
            if (await searchInput.isVisible({timeout: 2000})) {
                await searchInput.fill(unexpectedUser);
                await page.waitForTimeout(500);

                const userInResults = modal.locator(`text=@${unexpectedUser}`).first();
                const isVisible = await userInResults.isVisible({timeout: 2000});

                if (isVisible) {
                    // console.error(`✗ Non-matching user "${unexpectedUser}" FOUND in results (should NOT be there)`);
                    unexpectedUsersMatch = true;
                }

                await searchInput.fill('');
                await page.waitForTimeout(300);
            }
        }
    }

    const closeButton = modal.locator('button[aria-label*="Close" i], button:has-text("×"), .close').first();
    if (await closeButton.isVisible({timeout: 1000})) {
        await closeButton.click();
        await page.waitForTimeout(500);
    } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }

    return {
        totalMatches,
        matchingUsernames,
        expectedUsersMatch,
        unexpectedUsersMatch,
    };
}

/**
 * Create private channel with unique ID for ABAC testing
 */
export async function createPrivateChannelForABAC(client: Client4, teamId: string): Promise<Channel> {
    // Generate unique ID - lowercase alphanumeric only
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const channel = await client.createChannel({
        team_id: teamId,
        name: `abac${uniqueId}`,
        display_name: `ABAC-${uniqueId}`,
        type: 'P', // Private channel
    });
    return channel;
}

/**
 * Create basic policy using Table Editor (Simple mode)
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
    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(options.name);

    // Check if "Add attribute" button is disabled (means no attributes loaded)
    // If so, reload the page to fetch the newly created attributes
    const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        const isDisabled = await addAttributeButton.isDisabled();
        if (isDisabled) {
            await page.reload();
            await page.waitForLoadState('networkidle');

            // Re-fill the policy name after reload
            const nameInputAfterReload = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInputAfterReload.waitFor({state: 'visible', timeout: 10000});
            await nameInputAfterReload.fill(options.name);
        }
    }

    // Fill attribute, operator, value in table editor
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        const isDisabled = await addAttributeButton.isDisabled();
        if (!isDisabled) {
            await addAttributeButton.click();
            await page.waitForTimeout(1000);
        }
    }

    // Select attribute
    const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
    const menuIsOpen = await attributeMenu.isVisible({timeout: 2000});

    if (!menuIsOpen) {
        const attributeButton = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
        await attributeButton.click();
        await page.waitForTimeout(500);
    }

    const attributeOption = page.locator(`[id^="attribute-selector-menu"] li:has-text("${options.attribute}")`).first();
    await attributeOption.click({force: true});
    await page.waitForTimeout(500);

    // Select operator
    const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
    await operatorButton.waitFor({state: 'visible', timeout: 5000});
    await operatorButton.click({force: true});
    await page.waitForTimeout(500);

    const operatorMap: Record<string, string> = {
        '==': 'is',
        '!=': 'is not',
        in: 'is one of',
        contains: 'contains',
        startsWith: 'starts with',
        endsWith: 'ends with',
    };
    const operatorText = operatorMap[options.operator] || options.operator;
    const operatorOption = page.locator(`[id^="operator-selector-menu"] li:has-text("${operatorText}")`).first();
    await operatorOption.click({force: true});
    await page.waitForTimeout(500);

    // Fill value
    if (options.operator === 'in') {
        // Multi-value operator
        const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
        await valueButton.waitFor({state: 'visible', timeout: 10000});
        await valueButton.click({force: true});
        await page.waitForTimeout(500);

        const valueInput = page.locator('input[type="text"]').last();
        await valueInput.fill(options.value);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
    } else {
        // Single-value operator
        const valueInput = page.locator('.values-editor__simple-input, input[placeholder*="Add value" i]').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill(options.value);
        await page.waitForTimeout(500);
    }

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        await page.waitForTimeout(500);

        for (const channelName of options.channels) {
            const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').last();
            await searchInput.fill(channelName);
            await page.waitForTimeout(500);

            const channelOption = page
                .locator('.channel-selector-modal, [role="dialog"]')
                .locator('text=' + channelName)
                .first();
            await channelOption.click({force: true});
            await page.waitForTimeout(300);
        }

        const addButton = page.getByRole('button', {name: /^add$|^save$/i}).last();
        await addButton.click();
        await page.waitForTimeout(500);
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        await page.waitForTimeout(1000); // Wait for channel list to update

        // Click the header checkbox to enable auto-add for ALL channels
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();

            // Only click if we need to enable it
            if (!isChecked) {
                await headerCheckbox.click({force: true});
                await page.waitForTimeout(500);
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Click "Apply policy" button in confirmation modal (only appears if channels are assigned)
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    const applyVisible = await applyPolicyButton.isVisible({timeout: 3000}).catch(() => false);
    if (applyVisible) {
        await applyPolicyButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    } else {
        // No channels assigned, just wait for save to complete
        await page.waitForLoadState('networkidle');
    }
}

/**
 * Create policy with multiple attribute rules (Table Editor mode)
 */
export async function createMultiAttributePolicy(
    page: Page,
    options: {
        name: string;
        rules: Array<{attribute: string; operator: string; value: string}>;
        autoSync?: boolean;
        channels?: string[];
    },
): Promise<void> {
    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(options.name);

    // Check if "Add attribute" button is disabled (means no attributes loaded)
    const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        const isDisabled = await addAttributeButton.isDisabled();
        if (isDisabled) {
            await page.reload();
            await page.waitForLoadState('networkidle');

            const nameInputAfterReload = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInputAfterReload.waitFor({state: 'visible', timeout: 10000});
            await nameInputAfterReload.fill(options.name);
        }
    }

    // Add each rule
    for (let i = 0; i < options.rules.length; i++) {
        const rule = options.rules[i];

        // Click "Add attribute" to add a new row (for EVERY rule - there's no default row)
        const addAttrBtn = page.getByRole('button', {name: /add attribute/i});
        if ((await addAttrBtn.isVisible({timeout: 2000})) && !(await addAttrBtn.isDisabled())) {
            await addAttrBtn.click();
            await page.waitForTimeout(500);
        }

        // Select attribute - click the attribute selector for this row
        const attributeButtons = page.locator('[data-testid="attributeSelectorMenuButton"]');
        const attributeButton = attributeButtons.nth(i);
        await attributeButton.waitFor({state: 'visible', timeout: 5000});
        await attributeButton.click({force: true});
        await page.waitForTimeout(500);

        // Select the attribute from the menu
        const attributeOption = page
            .locator(`[id^="attribute-selector-menu"] li:has-text("${rule.attribute}")`)
            .first();
        await attributeOption.click({force: true});
        await page.waitForTimeout(500);

        // Select operator
        const operatorButtons = page.locator('[data-testid="operatorSelectorMenuButton"]');
        const operatorButton = operatorButtons.nth(i);
        await operatorButton.waitFor({state: 'visible', timeout: 5000});
        await operatorButton.click({force: true});
        await page.waitForTimeout(500);

        // Map operator to display text
        const operatorMap: Record<string, string> = {
            '==': 'is',
            '!=': 'is not',
            in: 'in',
            contains: 'contains',
            startsWith: 'starts with',
            endsWith: 'ends with',
        };
        const operatorText = operatorMap[rule.operator] || 'is';
        const operatorOption = page.locator(`[id^="operator-selector-menu"] li:has-text("${operatorText}")`).first();
        await operatorOption.click({force: true});
        await page.waitForTimeout(500);

        // Enter value - check if it's a text input or select menu
        const valueInput = page.locator('.values-editor__simple-input').nth(i);
        if (await valueInput.isVisible({timeout: 2000})) {
            await valueInput.fill(rule.value);
            await page.waitForTimeout(300);
        } else {
            // It might be a select/multiselect - click the value selector
            const valueButtons = page.locator('[data-testid="valueSelectorMenuButton"]');
            const valueButton = valueButtons.nth(i);
            if (await valueButton.isVisible({timeout: 2000})) {
                await valueButton.click({force: true});
                await page.waitForTimeout(500);

                const valueOption = page.locator(`[id^="value-selector-menu"] li:has-text("${rule.value}")`).first();
                await valueOption.click({force: true});
                await page.waitForTimeout(300);
            }
        }
    }

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        await page.waitForTimeout(500);

        for (const channelName of options.channels) {
            const searchInput = page
                .locator('[role="dialog"], .modal')
                .filter({hasText: /channel/i})
                .locator('input[placeholder*="Search" i]')
                .first();
            await searchInput.waitFor({state: 'visible', timeout: 5000});
            await searchInput.fill(channelName);
            await page.waitForTimeout(500);

            const channelOption = page
                .locator('.channel-selector-modal, [role="dialog"]')
                .locator('text=' + channelName)
                .first();
            await channelOption.click({force: true});
            await page.waitForTimeout(300);
        }

        const addButton = page.getByRole('button', {name: /^add$|^save$/i}).last();
        await addButton.click();
        await page.waitForTimeout(500);
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        await page.waitForTimeout(1000);

        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();
            if (!isChecked) {
                await headerCheckbox.click({force: true});
                await page.waitForTimeout(500);
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Click "Apply policy" button in confirmation modal
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    await applyPolicyButton.waitFor({state: 'visible', timeout: 5000});
    await applyPolicyButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
}

/**
 * Create advanced policy using CEL Editor (Advanced mode)
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
    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(options.name);

    // Switch to Advanced mode
    const advancedModeButton = page.getByRole('button', {name: /advanced/i});
    if (await advancedModeButton.isVisible({timeout: 2000})) {
        await advancedModeButton.click();
        await page.waitForTimeout(1000);
    }

    // Fill CEL expression in the Monaco editor
    // Monaco editor has a visual layer that intercepts clicks, so we need to:
    // 1. Click on the editor container to focus it
    // 2. Use keyboard to clear and type the expression
    const monacoContainer = page.locator('.monaco-editor').first();
    await monacoContainer.waitFor({state: 'visible', timeout: 5000});

    // Click on the visible lines area to focus the editor
    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.click({force: true});
    await page.waitForTimeout(300);

    // Select all existing content and replace with our expression
    // Use Cmd+A on Mac, Ctrl+A on others
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.waitForTimeout(100);

    // Type the CEL expression
    await page.keyboard.type(options.celExpression, {delay: 10});
    await page.waitForTimeout(1000);

    // Wait for the "Valid" indicator to appear
    const validIndicator = page.locator('text=Valid').first();
    await validIndicator.isVisible({timeout: 5000}).catch(() => false);

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        await page.waitForTimeout(1000);

        // Wait for the modal to appear
        const channelModal = page.locator('[role="dialog"]').filter({hasText: /channel/i});
        await channelModal.waitFor({state: 'visible', timeout: 5000});

        for (const channelName of options.channels) {
            // Find search input within the modal
            const searchInput = channelModal.locator('input').first();
            await searchInput.waitFor({state: 'visible', timeout: 5000});
            await searchInput.fill(channelName);
            await page.waitForTimeout(1000);

            // Click the "Select channel" button (the + button) to add it
            const selectChannelButton = channelModal.getByRole('button', {name: /select channel/i}).first();
            if (await selectChannelButton.isVisible({timeout: 5000})) {
                await selectChannelButton.click();
            }
            await page.waitForTimeout(300);
        }

        // Click Add button inside the modal to confirm
        const modalAddButton = channelModal.getByRole('button', {name: 'Add'});
        await modalAddButton.click();

        // Wait for modal to close
        await page.waitForTimeout(1000);
        const modalStillOpen = await channelModal.isVisible().catch(() => false);
        if (modalStillOpen) {
            // Try pressing Escape to close
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }
    }

    // Verify channels were added before saving
    if (options.channels && options.channels.length > 0) {
        const channelsTable = page
            .locator('.policy-channels-table, [class*="channel"]')
            .filter({hasText: options.channels[0]});
        await channelsTable.isVisible({timeout: 3000}).catch(() => false);
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        await page.waitForTimeout(1000); // Wait for channel list to update

        // Click the header checkbox to enable auto-add for ALL channels
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();

            // Only click if we need to enable it
            if (!isChecked) {
                await headerCheckbox.click({force: true});
                await page.waitForTimeout(500);
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});

    // Make sure Save button is enabled
    const saveEnabled = await saveButton.isEnabled({timeout: 5000}).catch(() => false);
    if (!saveEnabled) {
        // console.error(`❌ Save button is disabled - cannot save policy`);
        throw new Error(`Save button is disabled`);
    }

    await saveButton.click();
    await page.waitForTimeout(2000);

    // Check for error message
    const errorMessage = page.locator('text=/Unable to save|errors in the form/i').first();
    if (await errorMessage.isVisible({timeout: 2000}).catch(() => false)) {
        const errorText = await errorMessage.textContent();
        // console.error(`❌ Save failed: ${errorText}`);
        throw new Error(`Failed to save policy: ${errorText}`);
    }

    // Click "Apply policy" button in confirmation modal
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    const applyVisible = await applyPolicyButton.isVisible({timeout: 10000}).catch(() => false);

    if (applyVisible) {
        await applyPolicyButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    } else {
        // console.error(`❌ Apply Policy button not found`);
        throw new Error(`Apply Policy button not visible after Save`);
    }
}

/**
 * Activate a policy (set active: true)
 */
export async function activatePolicy(client: Client4, policyId: string): Promise<void> {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/activate?active=true`;
    await (client as any).doFetch(url, {method: 'GET'});
}

/**
 * Wait for sync job to complete and get the latest job row
 */
export async function waitForLatestSyncJob(page: Page, maxRetries: number = 5): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Wait a bit for the job to process
        await page.waitForTimeout(2000);

        // Reload the page to get fresh data
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Get the first (latest) job row
        const latestJobRow = page.locator('tr.clickable').first();

        if (await latestJobRow.isVisible({timeout: 3000})) {
            // Check the status
            const statusCell = latestJobRow.locator('td').first();
            const status = await statusCell.textContent();

            if (status?.trim() === 'Success') {
                return latestJobRow;
            } else if (status?.trim() === 'Error' || status?.trim() === 'Failed') {
                throw new Error(`Sync job failed with status: ${status?.trim()}`);
            }
        }
    }

    throw new Error(`Sync job did not complete after ${maxRetries} retries`);
}

/**
 * Open job details modal, search for a channel, get channel membership changes
 */
export async function getJobDetailsForChannel(
    page: Page,
    jobRow: any,
    channelName: string,
): Promise<{added: number; removed: number}> {
    // Click on the job row to open details modal
    await jobRow.click();
    await page.waitForTimeout(1000);

    // Wait for the Job Details modal to appear
    const jobDetailsModal = page.locator('[role="dialog"], .modal').filter({hasText: 'Job Details'});
    await jobDetailsModal.waitFor({state: 'visible', timeout: 5000});

    // Find the search input in the modal
    const searchInput = jobDetailsModal.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 3000});

    // Search for the channel
    await searchInput.fill(channelName);
    await page.waitForTimeout(1000);

    // Find and click the channel row to open Channel Membership Changes modal
    const channelRow = jobDetailsModal.locator(`text=${channelName}`).first();

    let added = 0;
    let removed = 0;

    if (await channelRow.isVisible({timeout: 3000})) {
        await channelRow.click();
        await page.waitForTimeout(1000);

        // Wait for the Channel Membership Changes modal
        const membershipModal = page.locator('[role="dialog"], .modal').filter({hasText: 'Channel Membership Changes'});

        if (await membershipModal.isVisible({timeout: 3000})) {
            // Parse Added count from the tab: "Added (X)"
            const addedTab = membershipModal.locator('text=/Added \\(\\d+\\)/i').first();
            if (await addedTab.isVisible({timeout: 2000})) {
                const addedText = await addedTab.textContent();
                const addedMatch = addedText?.match(/Added\s*\((\d+)\)/i);
                added = addedMatch ? parseInt(addedMatch[1]) : 0;
            }

            // Parse Removed count from the tab: "Removed (X)"
            const removedTab = membershipModal.locator('text=/Removed \\(\\d+\\)/i').first();
            if (await removedTab.isVisible({timeout: 2000})) {
                const removedText = await removedTab.textContent();
                const removedMatch = removedText?.match(/Removed\s*\((\d+)\)/i);
                removed = removedMatch ? parseInt(removedMatch[1]) : 0;
            }

            // Close the Channel Membership Changes modal
            const closeButton = membershipModal
                .locator('button[aria-label*="Close" i], .close, button:has-text("×")')
                .first();
            if (await closeButton.isVisible({timeout: 1000})) {
                await closeButton.click();
                await page.waitForTimeout(500);
            } else {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        } else {
            // Fallback: parse from the row text
            const channelRowParent = channelRow.locator('..').locator('..');
            const countsText = await channelRowParent.textContent();

            const addedMatch = countsText?.match(/\+(\d+)/);
            const removedMatch = countsText?.match(/-(\d+)/);

            added = addedMatch ? parseInt(addedMatch[1]) : 0;
            removed = removedMatch ? parseInt(removedMatch[1]) : 0;
        }
    }

    // Close the Job Details modal
    const closeJobDetailsButton = jobDetailsModal
        .locator('button[aria-label*="Close" i], .close, button:has-text("×")')
        .first();
    if (await closeJobDetailsButton.isVisible({timeout: 1000})) {
        await closeJobDetailsButton.click();
        await page.waitForTimeout(500);
    } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }

    return {added, removed};
}

/**
 * Check both recent jobs if they have similar timestamps
 * This handles the case where two jobs are created almost simultaneously
 */
export async function getJobDetailsFromRecentJobs(
    page: Page,
    channelName: string,
): Promise<{added: number; removed: number}> {
    // Get all job rows
    const jobRows = page.locator('tr.clickable');
    const jobCount = await jobRows.count();

    if (jobCount === 0) {
        return {added: 0, removed: 0};
    }

    // Get timestamps of first two jobs to check if they're close
    const job1Row = jobRows.nth(0);
    const job2Row = jobCount > 1 ? jobRows.nth(1) : null;

    // Get finish times from the rows
    const job1TimeCell = job1Row.locator('td').nth(1); // Second column is Finish Time
    const job1TimeText = await job1TimeCell.textContent();

    let checkBothJobs = false;
    if (job2Row) {
        const job2TimeCell = job2Row.locator('td').nth(1);
        const job2TimeText = await job2TimeCell.textContent();

        // Check if timestamps are within 2 minutes of each other
        // Parse times like "Jan 22, 2026 - 10:11 AM"
        if (job1TimeText && job2TimeText) {
            try {
                const time1 = new Date(job1TimeText.replace(' - ', ' ')).getTime();
                const time2 = new Date(job2TimeText.replace(' - ', ' ')).getTime();
                const diffMs = Math.abs(time1 - time2);
                const diffMinutes = diffMs / (1000 * 60);

                if (diffMinutes <= 2) {
                    checkBothJobs = true;
                }
            } catch {
                checkBothJobs = true;
            }
        }
    }

    let totalAdded = 0;
    let totalRemoved = 0;

    // Check first job
    const job1Details = await getJobDetailsForChannel(page, job1Row, channelName);
    totalAdded = Math.max(totalAdded, job1Details.added);
    totalRemoved = Math.max(totalRemoved, job1Details.removed);

    // Check second job if timestamps are close
    if (checkBothJobs && job2Row) {
        // Need to wait for page to stabilize after closing previous modal
        await page.waitForTimeout(500);
        const job2Details = await getJobDetailsForChannel(page, job2Row, channelName);
        totalAdded = Math.max(totalAdded, job2Details.added);
        totalRemoved = Math.max(totalRemoved, job2Details.removed);
    }

    return {added: totalAdded, removed: totalRemoved};
}

/**
 * Get policy ID by name using search API (with retry)
 */
export async function getPolicyIdByName(
    client: Client4,
    policyName: string,
    retries: number = 3,
): Promise<string | null> {
    const searchUrl = `${client.getBaseRoute()}/access_control/policies/search`;

    // Extract the base name without the random ID suffix for search
    // e.g., "Auto-Add Policy 48b0141" -> "Auto-Add Policy"
    const baseNameMatch = policyName.match(/^(.+?)\s+[a-z0-9]+$/i);
    const searchTerm = baseNameMatch ? baseNameMatch[1] : policyName;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Use the search API
            const result = await (client as any).doFetch(searchUrl, {
                method: 'POST',
                body: JSON.stringify({
                    term: searchTerm,
                }),
            });

            const policies = result?.policies || [];

            if (policies.length > 0) {
                // Try exact match first
                let policy = policies.find((p: any) => p.name === policyName);

                // If no exact match, try partial match
                if (!policy) {
                    policy = policies.find((p: any) => p.name.includes(searchTerm));
                }

                // If still no match, just take the first result
                if (!policy && policies.length > 0) {
                    policy = policies[0];
                }

                if (policy) {
                    return policy.id;
                } else {
                    // Wait before retrying
                    if (attempt < retries) {
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                    }
                }
            } else {
                // Wait before retrying
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        } catch {
            // console.error(`Failed to search policies (attempt ${attempt}):`, _error.message || String(_error));

            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    return null;
}
