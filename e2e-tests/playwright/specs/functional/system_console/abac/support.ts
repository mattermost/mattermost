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

import {newTestPassword} from '@mattermost/playwright-lib';

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
            password: newTestPassword(),
        } as any,
        '',
        '',
    );

    await setupCustomProfileAttributeValuesForUser(adminClient, attributes, attributeFieldsMap, user.id);

    // Attach the password back to the user object so pw.testBrowser.login() can authenticate.
    // The API response does not include the password field.
    (user as any).password = 'Passwd4Testing!';

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
): Promise<string | null> {
    // Ensure we are on the Membership Policies page before looking for "Add policy".
    // The ABAC settings page was split: the enable/disable toggle is now on
    // /attribute_based_access_control while the policy list lives on /membership_policies.
    if (!page.url().includes('/membership_policies')) {
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');
    }

    // Click Add policy button — nameInput.waitFor below is sufficient, no separate networkidle
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

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
            // Wait for the attribute selector menu to appear rather than sleeping
            await page
                .locator('[id^="attribute-selector-menu"]')
                .waitFor({state: 'visible', timeout: 5000})
                .catch(() => null);
        }
    }

    // Select attribute
    const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
    const menuIsOpen = await attributeMenu.isVisible({timeout: 500});

    if (!menuIsOpen) {
        const attributeButton = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
        await attributeButton.click();
        // Wait for the menu to open
        await page.locator('[id^="attribute-selector-menu"]').waitFor({state: 'visible', timeout: 5000});
    }

    const attributeOption = page.locator(`[id^="attribute-selector-menu"] li:has-text("${options.attribute}")`).first();
    await attributeOption.waitFor({state: 'visible', timeout: 3000});
    await attributeOption.click({force: true});

    // Select operator
    const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
    await operatorButton.waitFor({state: 'visible', timeout: 5000});
    await operatorButton.click({force: true});
    // Wait for operator menu to open
    await page.locator('[id^="operator-selector-menu"]').waitFor({state: 'visible', timeout: 3000});

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
    await operatorOption.waitFor({state: 'visible', timeout: 3000});
    await operatorOption.click({force: true});

    // Fill value
    if (options.operator === 'in') {
        // Multi-value operator
        const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
        await valueButton.waitFor({state: 'visible', timeout: 10000});
        await valueButton.click({force: true});
        // Wait for value input to appear
        const valueInput = page.locator('input[type="text"]').last();
        await valueInput.waitFor({state: 'visible', timeout: 3000});
        await valueInput.fill(options.value);
        await page.keyboard.press('Enter');
    } else {
        // Single-value operator
        const valueInput = page.locator('.values-editor__simple-input, input[placeholder*="Add value" i]').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill(options.value);
    }

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        // Wait for the channel modal to open
        const channelModal = page.locator('.channel-selector-modal, [role="dialog"]').first();
        await channelModal.waitFor({state: 'visible', timeout: 5000});

        for (const channelName of options.channels) {
            const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').last();
            await searchInput.waitFor({state: 'visible', timeout: 3000});
            await searchInput.fill(channelName);
            // Wait for the channel option to appear in search results
            const channelOption = page
                .locator('.channel-selector-modal, [role="dialog"]')
                .locator('text=' + channelName)
                .first();
            await channelOption.waitFor({state: 'visible', timeout: 5000});
            await channelOption.click({force: true});
        }

        const addButton = page.getByRole('button', {name: /^add$|^save$/i}).last();
        await addButton.click();
        // Wait for modal to close
        await channelModal.waitFor({state: 'hidden', timeout: 5000}).catch(() => null);
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        // Click the header checkbox to enable auto-add for ALL channels
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();

            // Only click if we need to enable it
            if (!isChecked) {
                await headerCheckbox.click({force: true});
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});

    // Intercept the POST/PUT response to capture the policy ID
    const policyResponsePromise = page.waitForResponse(
        (resp) =>
            resp.url().includes('/access_control_policies') &&
            (resp.request().method() === 'PUT' || resp.request().method() === 'POST') &&
            resp.ok(),
        {timeout: 15000},
    );

    await saveButton.click();

    let policyId: string | null = null;
    try {
        const response = await policyResponsePromise;
        const policy: {id?: string} = await response.json();
        policyId = policy.id ?? null;
    } catch {
        // fallback — caller gets null, will use global job list
    }

    // Click "Apply policy" button in confirmation modal (only appears if channels are assigned)
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    const applyVisible = await applyPolicyButton.isVisible({timeout: 3000}).catch(() => false);
    if (applyVisible) {
        await applyPolicyButton.click();
        await page.waitForLoadState('networkidle');
    } else {
        // No channels assigned, just wait for save to complete
        await page.waitForLoadState('networkidle');
    }

    return policyId;
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
    // Ensure we are on the Membership Policies page before looking for "Add policy".
    if (!page.url().includes('/membership_policies')) {
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');
    }

    // Click Add policy button — nameInput.waitFor below is sufficient, no separate networkidle
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

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
            // Wait for the new row's attribute selector button to appear
            await page
                .locator('[data-testid="attributeSelectorMenuButton"]')
                .nth(i)
                .waitFor({state: 'visible', timeout: 5000});
        }

        // Select attribute - click the attribute selector for this row
        const attributeButtons = page.locator('[data-testid="attributeSelectorMenuButton"]');
        const attributeButton = attributeButtons.nth(i);
        await attributeButton.waitFor({state: 'visible', timeout: 5000});
        await attributeButton.click({force: true});
        // Wait for the attribute menu to open
        const attrMenu = page.locator('[id^="attribute-selector-menu"]');
        await attrMenu.waitFor({state: 'visible', timeout: 3000});

        // Select the attribute from the menu
        const attributeOption = page
            .locator(`[id^="attribute-selector-menu"] li:has-text("${rule.attribute}")`)
            .first();
        await attributeOption.waitFor({state: 'visible', timeout: 3000});
        await attributeOption.click({force: true});
        await attrMenu.waitFor({state: 'hidden', timeout: 3000}).catch(() => {});

        // Select operator
        const operatorButtons = page.locator('[data-testid="operatorSelectorMenuButton"]');
        const operatorButton = operatorButtons.nth(i);
        await operatorButton.waitFor({state: 'visible', timeout: 5000});
        await operatorButton.click({force: true});
        // Wait for operator menu to open
        const opMenu = page.locator('[id^="operator-selector-menu"]');
        await opMenu.waitFor({state: 'visible', timeout: 3000});

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
        await operatorOption.waitFor({state: 'visible', timeout: 3000});
        await operatorOption.click({force: true});
        await opMenu.waitFor({state: 'hidden', timeout: 3000}).catch(() => {});

        // Enter value - check if it's a text input or select menu
        const valueInput = page.locator('.values-editor__simple-input').nth(i);
        if (await valueInput.isVisible({timeout: 2000})) {
            await valueInput.fill(rule.value);
            // No sleep needed — fill is a synchronous state change
        } else {
            // It might be a select/multiselect - click the value selector
            const valueButtons = page.locator('[data-testid="valueSelectorMenuButton"]');
            const valueButton = valueButtons.nth(i);
            if (await valueButton.isVisible({timeout: 2000})) {
                await valueButton.click({force: true});
                const valueMenu = page.locator('[id^="value-selector-menu"]');
                await valueMenu.waitFor({state: 'visible', timeout: 3000}).catch(() => {});

                const valueOption = page.locator(`[id^="value-selector-menu"] li:has-text("${rule.value}")`).first();
                await valueOption.waitFor({state: 'visible', timeout: 3000}).catch(() => {});
                await valueOption.click({force: true});
                await valueMenu.waitFor({state: 'hidden', timeout: 3000}).catch(() => {});
            }
        }
    }

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        // Wait for the channel modal to open
        const channelModalMulti = page
            .locator('[role="dialog"], .modal')
            .filter({hasText: /channel/i})
            .first();
        await channelModalMulti.waitFor({state: 'visible', timeout: 5000});

        for (const channelName of options.channels) {
            const searchInput = channelModalMulti.locator('input[placeholder*="Search" i]').first();
            await searchInput.waitFor({state: 'visible', timeout: 3000});
            await searchInput.fill(channelName);
            // Wait for search results to appear
            const channelOption = page
                .locator('.channel-selector-modal, [role="dialog"]')
                .locator('text=' + channelName)
                .first();
            await channelOption.waitFor({state: 'visible', timeout: 5000});
            await channelOption.click({force: true});
        }

        const addButton = page.getByRole('button', {name: /^add$|^save$/i}).last();
        await addButton.click();
        // Wait for modal to close
        await channelModalMulti.waitFor({state: 'hidden', timeout: 5000}).catch(() => {});
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        // Wait for the header checkbox to become visible (channel list rendered)
        const headerCheckbox = page.locator('#auto-add-header-checkbox');
        await headerCheckbox.waitFor({state: 'visible', timeout: 5000}).catch(() => {});

        if (await headerCheckbox.isVisible({timeout: 1000}).catch(() => false)) {
            const isChecked = await headerCheckbox.isChecked();
            if (!isChecked) {
                await headerCheckbox.click({force: true});
            }
        }
    }

    // Save policy and confirm — wait for the apply-policy modal rather than sleeping
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    // Click "Apply policy" button in confirmation modal
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    await applyPolicyButton.waitFor({state: 'visible', timeout: 5000});
    await applyPolicyButton.click();
    await page.waitForLoadState('networkidle');
    // Removed: waitForTimeout(2000) — networkidle is sufficient
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
): Promise<string | null> {
    // Ensure we are on the Membership Policies page before looking for "Add policy".
    if (!page.url().includes('/membership_policies')) {
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');
    }

    // Click Add policy button — nameInput.waitFor below is sufficient, no separate networkidle
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(options.name);

    // Switch to Advanced mode
    const advancedModeButton = page.getByRole('button', {name: /advanced/i});
    if (await advancedModeButton.isVisible({timeout: 2000})) {
        await advancedModeButton.click();
        // Wait for the Monaco editor to appear instead of sleeping
        await page.locator('.monaco-editor').first().waitFor({state: 'visible', timeout: 5000});
    }

    // Fill CEL expression in the Monaco editor.
    // Monaco exposes a hidden textarea (.inputarea) that accepts programmatic fill,
    // which is ~10× faster than simulating individual keystrokes with keyboard.type.
    const monacoContainer = page.locator('.monaco-editor').first();
    await monacoContainer.waitFor({state: 'visible', timeout: 5000});

    // Focus the editor via its accessible textarea
    const monacoTextarea = page.locator('.monaco-editor textarea.inputarea').first();
    await monacoTextarea.waitFor({state: 'visible', timeout: 5000}).catch(async () => {
        // Fallback: click to focus then type
        const editorLines = page.locator('.monaco-editor .view-lines').first();
        await editorLines.click({force: true});
    });

    // Select all existing content and replace in one operation
    const isMac = process.platform === 'darwin';
    await monacoTextarea.focus().catch(() => {});
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.keyboard.type(options.celExpression);

    // Wait for the "Valid" indicator to appear (confirms expression parsed)
    const validIndicator = page.locator('text=Valid').first();
    await validIndicator.waitFor({state: 'visible', timeout: 5000}).catch(() => null);

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();

        // Wait for the modal to appear.
        // ChannelSelectorModal sets role='none' on its outer element, so we locate
        // by its dialog CSS class (dialogClassName='...channel-selector-modal') instead
        // of [role="dialog"] which would not match.
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor({state: 'visible', timeout: 10000});

        for (const channelName of options.channels) {
            // Find search input within the modal
            const searchInput = channelModal.locator('input').first();
            await searchInput.waitFor({state: 'visible', timeout: 5000});
            await searchInput.fill(channelName);
            // Wait for search results to populate
            const selectChannelButton = channelModal.getByRole('button', {name: /select channel/i}).first();
            await selectChannelButton.waitFor({state: 'visible', timeout: 5000});
            await selectChannelButton.click();
        }

        // Click Add button inside the modal to confirm
        const modalAddButton = channelModal.getByRole('button', {name: 'Add'});
        await modalAddButton.click();

        // Wait for modal to close
        await channelModal.waitFor({state: 'hidden', timeout: 5000}).catch(async () => {
            // Try pressing Escape to close if still open
            await page.keyboard.press('Escape');
        });
    }

    // Verify channels were added before saving
    if (options.channels && options.channels.length > 0) {
        const channelsTable = page
            .locator('.policy-channels-table, [class*="channel"]')
            .filter({hasText: options.channels[0]});
        await channelsTable.waitFor({state: 'visible', timeout: 3000}).catch(() => null);
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        // Click the header checkbox to enable auto-add for ALL channels
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();

            // Only click if we need to enable it
            if (!isChecked) {
                await headerCheckbox.click({force: true});
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});

    // Make sure Save button is enabled
    const saveEnabled = await saveButton.isEnabled({timeout: 5000}).catch(() => false);
    if (!saveEnabled) {
        throw new Error(`Save button is disabled`);
    }

    // Intercept the POST/PUT response to capture the policy ID
    const policyResponsePromise = page.waitForResponse(
        (resp) =>
            resp.url().includes('/access_control_policies') &&
            (resp.request().method() === 'PUT' || resp.request().method() === 'POST') &&
            resp.ok(),
        {timeout: 15000},
    );

    await saveButton.click();

    let policyId: string | null = null;
    try {
        const response = await policyResponsePromise;
        const policy: {id?: string} = await response.json();
        policyId = policy.id ?? null;
    } catch {
        // fallback — caller gets null, will use global job list
    }

    // Check for error message
    const errorMessage = page.locator('text=/Unable to save|errors in the form/i').first();
    if (await errorMessage.isVisible({timeout: 2000}).catch(() => false)) {
        const errorText = await errorMessage.textContent();
        throw new Error(`Failed to save policy: ${errorText}`);
    }

    // Click "Apply policy" button in confirmation modal
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    const applyVisible = await applyPolicyButton.isVisible({timeout: 10000}).catch(() => false);

    if (applyVisible) {
        await applyPolicyButton.click();
        await page.waitForLoadState('networkidle');
    } else {
        throw new Error(`Apply Policy button not visible after Save`);
    }

    return policyId;
}

/**
 * Activate a policy (set active: true)
 */
export async function activatePolicy(client: Client4, policyId: string): Promise<void> {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/activate?active=true`;
    await (client as any).doFetch(url, {method: 'GET'});
}

/**
 * Return the ID of the most recent access_control_sync job, or null if none exist.
 *
 * Call this before triggering a sync action and pass the result as skipJobId to
 * waitForLatestSyncJob so it skips the previously-completed job and waits only for
 * the new one.
 */
export async function captureLatestJobId(page: Page, policyId?: string | null): Promise<string | null> {
    const origin = new URL(page.url()).origin;
    const policyParam = policyId ? `&policy_id=${encodeURIComponent(policyId)}` : '';
    const jobsUrl = `${origin}/api/v4/jobs/type/access_control_sync?page=0&per_page=1${policyParam}`;
    try {
        const response = await page.request.get(jobsUrl);
        if (response.ok()) {
            const jobs: Array<{id: string}> = await response.json();
            return jobs.length > 0 ? jobs[0].id : null;
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Wait for a specific access_control_sync job to complete.
 *
 * There are two safe calling patterns:
 *
 *   Fast path (preferred): pass `jobId` returned by `runSyncJob`. The function
 *   polls GET /api/v4/jobs/{jobId} directly and never touches the global job
 *   list — fully race-safe regardless of how many parallel tests run.
 *
 *   Policy-scoped fallback: pass `policyId` when the sync was triggered as a
 *   side effect of saving a policy (e.g. createAdvancedPolicy). The list query
 *   is filtered with `&policy_id={policyId}` so only jobs for THIS policy are
 *   considered. Because every test creates a unique policy, two parallel workers
 *   can never see each other's jobs through this filter.
 *
 * Calling without either `jobId` or `policyId` is not allowed: it would poll
 * the globally-latest job, which is racey with PW_WORKERS > 1.
 *
 * @param page - Playwright page used for auth context and the final reload.
 * @param maxRetries - Maps to a wall-clock timeout of max(maxRetries × 12s, 60s).
 * @param skipJobId - ID of a previously-completed job to ignore (Phase 1 only).
 *   Obtain via captureLatestJobId before triggering the sync action.
 * @param jobId - Exact ID of the job to wait for, obtained from runSyncJob.
 *   When present, `policyId`, `skipJobId`, and Phase 1 are bypassed entirely.
 * @param policyId - Policy UUID used to scope the Phase 1 job-list poll.
 *   Required when `jobId` is not available (e.g. sync triggered by policy save).
 * @returns the ID of the completed job.
 */
export async function waitForLatestSyncJob(
    page: Page,
    maxRetries: number = 5,
    skipJobId?: string | null,
    jobId?: string | null,
    policyId?: string | null,
): Promise<string | null> {
    const pollIntervalMs = 200;
    const timeoutMs = Math.max(maxRetries * 12000, 30000);
    const startTime = Date.now();
    const deadline = startTime + timeoutMs;

    const origin = new URL(page.url()).origin;

    // ── Fast path: skip Phase 1 when the caller already has the job ID ─────
    if (jobId) {
        const jobUrl = `${origin}/api/v4/jobs/${jobId}`;
        while (Date.now() < deadline) {
            let job: {id: string; status: string} | null = null;
            try {
                const response = await page.request.get(jobUrl);
                if (response.ok()) {
                    job = await response.json();
                }
            } catch {
                // Network hiccup — keep polling
            }
            if (job) {
                if (job.status === 'success') {
                    await page.reload();
                    await page.waitForLoadState('domcontentloaded');
                    return job.id;
                }
                if (job.status === 'error' || job.status === 'canceled') {
                    throw new Error(`Sync job failed with status: ${job.status}`);
                }
            }
            await page.waitForTimeout(pollIntervalMs);
        }
        throw new Error(`Sync job did not complete within ${timeoutMs / 1000}s`);
    }

    // Require policyId when jobId is absent. Polling the globally-latest job
    // without a scoping filter is racey when parallel workers are running — a
    // different worker could create a newer access_control_sync job between
    // when we trigger ours and when we poll the list.
    if (!policyId) {
        throw new Error(
            'waitForLatestSyncJob: policyId is required when jobId is not provided. ' +
                'Pass the jobId returned by runSyncJob, or pass the policyId of the ' +
                'policy whose sync you are waiting for.',
        );
    }

    // Without a skipJobId, reject jobs older than 30 seconds to avoid picking
    // up ancient stale results from a previous test or run.
    const staleThresholdMs = 30000;

    const policyParam = `&policy_id=${encodeURIComponent(policyId)}`;
    const listUrl = `${origin}/api/v4/jobs/type/access_control_sync?page=0&per_page=1${policyParam}`;

    // ── Phase 1: identify the specific job we are waiting for ──────────────
    let expectedJobId: string | null = null;
    let initialStatus: string | null = null;

    while (!expectedJobId && Date.now() < deadline) {
        let jobs: Array<{id: string; status: string; create_at: number}> = [];
        try {
            const response = await page.request.get(listUrl);
            if (response.ok()) {
                jobs = await response.json();
            }
        } catch {
            // Network hiccup — keep polling
        }

        if (jobs.length > 0) {
            const latest = jobs[0];

            // Skip the known prior job — the new one hasn't appeared yet.
            if (skipJobId && latest.id === skipJobId) {
                await page.waitForTimeout(pollIntervalMs);
                continue;
            }

            // Without a skipJobId, reject ancient stale jobs.
            if (!skipJobId && latest.create_at < startTime - staleThresholdMs) {
                await page.waitForTimeout(pollIntervalMs);
                continue;
            }

            // Found the job we care about.
            expectedJobId = latest.id;
            initialStatus = latest.status;
        } else {
            await page.waitForTimeout(pollIntervalMs);
        }
    }

    if (!expectedJobId) {
        throw new Error(`Sync job did not appear within ${timeoutMs / 1000}s`);
    }

    // Fast path: job was already done when discovered in Phase 1.
    if (initialStatus === 'success') {
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        return expectedJobId;
    }
    if (initialStatus === 'error' || initialStatus === 'canceled') {
        throw new Error(`Sync job failed with status: ${initialStatus}`);
    }

    // ── Phase 2: poll the specific job by ID until it reaches a terminal status
    const jobUrl = `${origin}/api/v4/jobs/${expectedJobId}`;

    while (Date.now() < deadline) {
        let job: {id: string; status: string} | null = null;
        try {
            const response = await page.request.get(jobUrl);
            if (response.ok()) {
                job = await response.json();
            }
        } catch {
            // Network hiccup — keep polling
        }

        if (job) {
            if (job.status === 'success') {
                // One reload to sync the DOM for any subsequent page interactions.
                await page.reload();
                await page.waitForLoadState('domcontentloaded');
                return job.id;
            }
            if (job.status === 'error' || job.status === 'canceled') {
                throw new Error(`Sync job failed with status: ${job.status}`);
            }
            // 'pending' or 'in_progress' → keep polling
        }

        await page.waitForTimeout(pollIntervalMs);
    }

    throw new Error(`Sync job did not complete within ${timeoutMs / 1000}s`);
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

/**
 * Create a permission policy using the CEL (Advanced) editor.
 * Caller must already be on the Permission Policies list page.
 * Available permissions: 'download_file_attachment' | 'upload_file_attachment'
 * Available roles: 'system_guest' | 'system_user' | 'system_admin'
 */
export async function createPermissionPolicy(
    page: Page,
    options: {
        name: string;
        celExpression: string;
        permissions: Array<'Download Files' | 'Upload Files'>;
        role?: 'system_guest' | 'system_user' | 'system_admin';
    },
): Promise<void> {
    await navigateToPermissionPoliciesPage(page);

    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.waitFor({state: 'visible', timeout: 15000});
    await addPolicyButton.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    await page.getByPlaceholder('Add a unique policy name').fill(options.name);

    // Set role if not the default (system_user) using the role dropdown
    if (options.role && options.role !== 'system_user') {
        await page.locator('#pp-role-selector-btn').click();
        await page.locator(`#pp-role-option-${options.role}`).click();
    }

    // Switch to Advanced (CEL) mode and enter expression
    await page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();

    const monacoContainer = page.locator('.monaco-editor').first();
    await monacoContainer.waitFor({state: 'visible', timeout: 5000});

    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.click({force: true});
    await page.waitForTimeout(300);

    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.waitForTimeout(100);
    await page.keyboard.type(options.celExpression, {delay: 10});

    // Add each permission via the menu.
    // Items are keyed by their action value, e.g. pp-add-permission-download_file_attachment.
    const permissionIdMap: Record<string, string> = {
        'Download Files': 'pp-add-permission-download_file_attachment',
        'Upload Files': 'pp-add-permission-upload_file_attachment',
    };
    for (const permission of options.permissions) {
        await page.getByRole('button', {name: 'Add permission'}).click();
        await page.locator(`#${permissionIdMap[permission]}`).click();
    }

    await page.getByRole('button', {name: 'Save'}).last().click();
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate to Permission Policies and ensure the route is available.
 * Throws a clear error when the webapp bundle does not include this page.
 */
export async function navigateToPermissionPoliciesPage(page: Page): Promise<void> {
    await page.goto('/admin_console/system_attributes/permission_policies');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin_console/about/license')) {
        throw new Error(
            'Permission Policies page is unavailable and redirected to License. Rebuild and run webapp from a branch that includes the permission policies route before running ABAC tests.',
        );
    }
}

/**
 * Delete a permission policy by name using the API.
 * Searches for the policy by name, then deletes it by ID.
 * Safe to call even if the policy does not exist (no-op).
 */
/**
 * Delete a permission policy by name via the REST API.
 * Uses doFetch (same pattern as getPolicyIdByName) to find the policy by name,
 * then issues a DELETE. Safe to call even if the policy does not exist.
 */
export async function deletePermissionPolicyByName(client: Client4, policyName: string): Promise<void> {
    try {
        const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;
        const result = await (client as any).doFetch(searchUrl, {
            method: 'POST',
            body: JSON.stringify({term: policyName, type: 'permission'}),
        });

        // Response may be the array directly or wrapped in {policies: [...]}
        const policies: any[] = Array.isArray(result) ? result : result?.policies || [];
        const match = policies.find((p: any) => p.name === policyName && p.type === 'permission');

        if (match?.id) {
            await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${match.id}`, {
                method: 'DELETE',
            });
        }
    } catch {
        // Policy may not exist or deletion may have already occurred — safe to ignore
    }
}

/**
 * Delete ALL permission policies in the system.
 * Call this at the start of file-permission E2E tests to ensure no stale
 * policies from previous runs interfere with the "no-policy = implicit allow" assertions.
 */
/**
 * Delete ALL permission policies in the system.
 * Uses the typed searchPermissionPolicies client method which sends the correct
 * cursor + limit payload. Falls back to a doFetch approach if needed.
 * Safe to call when no policies exist.
 */
export async function cleanupAllPermissionPolicies(client: Client4): Promise<void> {
    let cursor = '';
    const limit = 100;

    while (true) {
        let policies: any[] = [];
        try {
            // Use the typed method (available in the rebuilt @mattermost/client dist)
            const result = await (client as any).searchPermissionPolicies('', cursor, limit);
            policies = result?.policies || [];
        } catch {
            // Typed method unavailable — fall back to raw doFetch with explicit limit
            try {
                const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;
                const result = await (client as any).doFetch(searchUrl, {
                    method: 'POST',
                    body: JSON.stringify({term: '', type: 'permission', cursor: {id: cursor}, limit}),
                });
                policies = Array.isArray(result) ? result : result?.policies || [];
            } catch {
                break;
            }
        }

        if (policies.length === 0) {
            break;
        }

        await Promise.all(
            policies.map(async (policy: any) => {
                if (policy?.id) {
                    try {
                        await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policy.id}`, {
                            method: 'DELETE',
                        });
                    } catch {
                        // ignore individual delete failures
                    }
                }
            }),
        );

        if (policies.length < limit) {
            break;
        }

        cursor = policies[policies.length - 1].id;
    }
}
