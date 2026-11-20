// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared ABAC test helper functions
 * These functions are used across multiple ABAC test files to reduce duplication
 */

import {expect, type Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {getRandomId, newTestPassword} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeValuesForUser} from '../../channels/custom_profile_attributes/helpers';

function policyWriteResponse(page: Page) {
    return page.waitForResponse((r) => {
        const url = r.url();
        const method = r.request().method();
        return (
            url.includes('/api/v4/access_control_policies') &&
            !url.includes('/cel/') &&
            !url.includes('/search') &&
            !url.includes('/activate') &&
            (method === 'POST' || method === 'PUT')
        );
    });
}

function channelSearchResponse(page: Page, term?: string) {
    return page.waitForResponse(async (r) => {
        if (!r.url().includes('/api/v4/channels/search') || r.request().method() !== 'POST') {
            return false;
        }
        if (term === undefined) {
            return true;
        }
        try {
            const body = r.request().postDataJSON() as {term?: string};
            return body?.term === term;
        } catch {
            return false;
        }
    });
}

function celTestResponse(page: Page, term?: string) {
    return page.waitForResponse(async (r) => {
        if (!r.url().includes('/api/v4/access_control_policies/cel/test') || r.request().method() !== 'POST') {
            return false;
        }
        if (term === undefined) {
            return true;
        }
        try {
            const body = r.request().postDataJSON() as {term?: string};
            return body?.term === term;
        } catch {
            return false;
        }
    });
}

/**
 * Verify policy exists with better waiting and retry logic
 */
export async function verifyPolicyExists(page: Page, policyName: string): Promise<boolean> {
    const policyElement = page.locator('.policy-name').filter({hasText: policyName});
    const listReady = policyElement.or(page.getByRole('button', {name: 'Add policy'}));

    // Reload between attempts when the row has not shown up yet.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await expect(policyElement).toBeVisible({timeout: 5000});
            return true;
        } catch {
            if (attempt < 2) {
                await page.reload({waitUntil: 'domcontentloaded'});
                await expect(listReady).toBeVisible();
            }
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
        name,
        type,
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
 * Membership policy UI loads CPA fields from GET .../cel/autocomplete/fields.
 * Fail fast here instead of timing out on disabled "Test access rule" when fields lag.
 */
export async function assertAccessControlAutocompleteContains(
    adminClient: Client4,
    fieldNames: string[],
): Promise<void> {
    const fields = await adminClient.getAccessControlFields('', 100);
    const names = new Set(fields.map((f) => f.name));
    for (const n of fieldNames) {
        expect(
            names.has(n),
            `ABAC autocomplete API missing "${n}" — policy editor will treat attributes as unusable. Got: ${[...names].join(', ')}`,
        ).toBe(true);
    }
}

export async function enableUserManagedAttributes(client: Client4): Promise<void> {
    try {
        await client.patchConfig({
            AccessControlSettings: {
                EnableUserManagedAttributes: true,
            },
        } as any);
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
 * Resolve a user (CPA) attribute field by name. Attribute-picker menu items are
 * keyed by field id (`#attribute-<id>`), so callers targeting a specific user
 * attribute must look up its id rather than hardcoding its name.
 */
export async function getUserAttributeFieldByName(client: Client4, name: string): Promise<UserPropertyField> {
    const fields = await client.getCustomProfileAttributeFields();
    const field = fields.find((f) => f.name === name);
    if (!field) {
        throw new Error(`User attribute "${name}" not found`);
    }
    return field;
}

/**
 * Navigate to User Attributes page and create attributes via UI
 */
export async function setupUserAttributesViaUI(page: Page, attributes: string[]): Promise<void> {
    // Navigate to System Attributes → User Attributes
    await page.goto('/admin_console/system_attributes/user_attributes', {waitUntil: 'domcontentloaded'});
    const addButton = page.getByRole('button', {name: /add.*attribute/i});
    await expect(addButton).toBeVisible();

    for (const attrName of attributes) {
        // Click "Add attribute" button
        if (await addButton.isVisible({timeout: 2000})) {
            await addButton.click();

            // Fill attribute name
            const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').last();
            await expect(nameInput).toBeVisible();
            await nameInput.fill(attrName);

            // Select type (default to Text)
            // Save attribute
            const saveButton = page.getByRole('button', {name: /save/i});
            if (await saveButton.isVisible({timeout: 1000})) {
                const created = page.waitForResponse(
                    (r) => r.url().includes('/custom_profile_attributes/fields') && r.request().method() === 'POST',
                );
                await saveButton.click();
                await created;
                await expect(page.getByText(attrName, {exact: true}).first()).toBeVisible();
            }
        }
    }

    // Save the page
    const savePageButton = page.getByRole('button', {name: 'Save'}).first();
    if (await savePageButton.isVisible({timeout: 2000})) {
        const saved = page.waitForResponse(
            (r) =>
                (r.url().includes('/api/v4/config') || r.url().includes('/custom_profile_attributes')) &&
                (r.request().method() === 'PUT' || r.request().method() === 'POST'),
        );
        await savePageButton.click();
        await saved;
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
    // Username must start with a letter
    const username = `user${getRandomId()}`.toLowerCase();
    const password = newTestPassword();

    // Create the user
    const user = await adminClient.createUser(
        {
            email: `${username}@example.com`,
            username,
            password,
        } as any,
        '',
        '',
    );

    await setupCustomProfileAttributeValuesForUser(adminClient, attributes, attributeFieldsMap, user.id);

    // Attach the password back to the user object so pw.testBrowser.login() can authenticate.
    // The API response does not include the password field.
    (user as any).password = password;

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
    const testButton = page.getByRole('button', {name: /test access rule/i});
    await expect(testButton).toBeVisible({timeout: 10_000});
    await expect(testButton).toBeEnabled({timeout: 15_000});
    await testButton.click();

    const modal = page.locator('[role="dialog"], .modal').filter({hasText: 'Access Rule Test Results'});
    await expect(modal).toBeVisible();

    let totalMatches = 0;

    const countText = await modal
        .locator('text=/\\d+.*(?:members|total|match)/i')
        .first()
        .textContent({timeout: 5000})
        .catch(() => null);

    if (countText) {
        const totalMatch = countText.match(/of\s*(\d+)\s*total/i);
        if (totalMatch) {
            totalMatches = parseInt(totalMatch[1], 10);
        } else {
            const matchesMatch = countText.match(/(\d+)\s*match/i);
            if (matchesMatch) {
                totalMatches = parseInt(matchesMatch[1], 10);
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
            const searched = celTestResponse(page, options.searchForUser);
            await searchInput.fill(options.searchForUser);
            await searched;
        }
    }

    let expectedUsersMatch = true;
    if (options.expectedMatchingUsers && options.expectedMatchingUsers.length > 0) {
        for (const expectedUser of options.expectedMatchingUsers) {
            const searchInput = modal.locator('input[placeholder*="Search" i]').first();
            if (await searchInput.isVisible({timeout: 2000})) {
                const searched = celTestResponse(page, expectedUser);
                await searchInput.fill(expectedUser);
                await searched;

                const userInResults = modal.locator(`text=@${expectedUser}`).first();
                const isVisible = await userInResults.isVisible({timeout: 5000});

                if (!isVisible) {
                    // console.error(`✗ Expected user "${expectedUser}" NOT found in matching results`);
                    expectedUsersMatch = false;
                }

                const cleared = celTestResponse(page, '');
                await searchInput.fill('');
                await cleared;
            }
        }
    }

    let unexpectedUsersMatch = false;
    if (options.expectedNonMatchingUsers && options.expectedNonMatchingUsers.length > 0) {
        for (const unexpectedUser of options.expectedNonMatchingUsers) {
            const searchInput = modal.locator('input[placeholder*="Search" i]').first();
            if (await searchInput.isVisible({timeout: 2000})) {
                const searched = celTestResponse(page, unexpectedUser);
                await searchInput.fill(unexpectedUser);
                await searched;

                const userInResults = modal.locator(`text=@${unexpectedUser}`).first();
                const isVisible = await userInResults.isVisible({timeout: 2000});

                if (isVisible) {
                    // console.error(`✗ Non-matching user "${unexpectedUser}" FOUND in results (should NOT be there)`);
                    unexpectedUsersMatch = true;
                }

                const cleared = celTestResponse(page, '');
                await searchInput.fill('');
                await cleared;
            }
        }
    }

    const closeButton = modal.locator('button[aria-label*="Close" i], button:has-text("×"), .close').first();
    if (await closeButton.isVisible({timeout: 1000})) {
        await closeButton.click();
    } else {
        await page.keyboard.press('Escape');
    }
    await expect(modal).toBeHidden();

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
 * Fill a single-value condition in the table editor's value cell.
 *
 * A free-text attribute's value editor renders one of two ways depending on
 * what comparison targets are available:
 *   - an always-visible inline input (.values-editor__simple-input), when there
 *     are no comparable channel-attribute targets; or
 *   - a dropdown (valueSelectorMenuButton) whose "Add value..." field is only
 *     revealed after the menu is opened, when channel attributes are offered as
 *     comparison targets.
 *
 * Since channel (resource) attributes are system-wide, whether the dropdown
 * appears depends on data that other specs may have created on the shared
 * server. Handle both variants so the helper is agnostic to that.
 *
 * An attribute that carries options also renders the dropdown, but with a
 * filter field rather than "Add value..." — pick the option from the menu
 * instead of calling this.
 */
export async function fillSingleConditionValue(page: Page, value: string): Promise<void> {
    const inlineInput = page.locator('.values-editor__simple-input').first();
    const menuButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();

    // Wait for whichever variant rendered after the operator was chosen.
    await page
        .locator('.values-editor__simple-input, [data-testid="valueSelectorMenuButton"]')
        .first()
        .waitFor({state: 'visible', timeout: 10000});

    if (await inlineInput.isVisible().catch(() => false)) {
        await inlineInput.fill(value);
        await inlineInput.press('Tab'); // commit (onBlur)
        await expect(inlineInput).toHaveValue(value);
        return;
    }

    // Dropdown variant: open the menu, then fill the "Add value..." field inside it.
    // Match on the accessible name, not the placeholder: the menu autofocuses this
    // input, and Input only sets a placeholder attribute while unfocused (the text
    // moves into the floating legend), so a placeholder locator resolves to nothing.
    await menuButton.click({force: true});
    const menuInput = page.locator('input[aria-label*="Add value" i], input[placeholder*="Add value" i]').first();

    // A click that lands while a sibling menu (e.g. the operator selector the caller
    // just used) is still closing is spent dismissing that menu instead, leaving this
    // one shut. Re-click once rather than requiring every caller to pause first. The
    // gate has to be a waitFor, not isVisible(), which returns immediately and would
    // toggle the menu straight back shut.
    try {
        await menuInput.waitFor({state: 'visible', timeout: 3000});
    } catch {
        await menuButton.click({force: true});
        await menuInput.waitFor({state: 'visible', timeout: 10000});
    }
    await menuInput.fill(value);

    // Tab commits (input onBlur) and closes the menu (menu closeMenuOnTab), so
    // the dropdown doesn't overlay later actions. Enter would commit but leave
    // the menu open, and Escape is swallowed by the input's stopPropagation.
    await menuInput.press('Tab');
    await expect(menuInput).toBeHidden();
    await expect(menuButton).toContainText(value);
}

/**
 * Create basic policy using Table Editor (Simple mode)
 */
/**
 * Returns the sync job ID triggered by the "Apply policy" confirmation, or null
 * when no channels are assigned (no sync is triggered). Pass the returned ID to
 * waitForLatestSyncJob so you get race-safe job polling instead of UI table scraping.
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
        await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'domcontentloaded'});
        await expect(page.getByRole('button', {name: 'Add policy'})).toBeVisible();
    }

    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(options.name);

    // Check if "Add attribute" button is disabled (means no attributes loaded).
    // If so, reload the page to fetch the newly created attributes, then wait
    // up to ~10 s for the button to become enabled before proceeding.
    const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        if (await addAttributeButton.isDisabled()) {
            await page.reload({waitUntil: 'domcontentloaded'});

            // Re-fill the policy name after reload
            const nameInputAfterReload = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await expect(nameInputAfterReload).toBeVisible();
            await nameInputAfterReload.fill(options.name);

            // Attributes can lag the reload. Keep going if they never enable so Save
            // still exercises server-side validation.
            await expect(addAttributeButton)
                .toBeEnabled()
                .catch(() => undefined);
        }
    }

    // Fill attribute, operator, value in table editor.
    // Track whether we successfully added a row — only proceed with attribute/operator/value
    // selection if we did. When attributes are unavailable (e.g. wiped by a concurrent
    // initSetup()) the "Add attribute" button stays disabled and no row is created, so
    // attributeSelectorMenuButton will never appear. Skipping the section lets the test
    // fall through to Save, where server-side validation (e.g. duplicate-name check) still runs.
    let clickedAddAttribute = false;
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        const isDisabled = await addAttributeButton.isDisabled();
        if (!isDisabled) {
            await addAttributeButton.click();
            await expect(page.locator('[data-testid="attributeSelectorMenuButton"]').first()).toBeVisible();
            clickedAddAttribute = true;
        }
    }

    // Select attribute (only when a row was actually created above)
    if (clickedAddAttribute) {
        const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
        const menuIsOpen = await attributeMenu.isVisible({timeout: 2000});

        if (!menuIsOpen) {
            const attributeButton = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
            await attributeButton.click();
            await expect(attributeMenu).toBeVisible();
        }

        const attributeOption = page
            .locator(`[id^="attribute-selector-menu"] li:has-text("${options.attribute}")`)
            .first();
        await expect(attributeOption).toBeVisible();
        await attributeOption.click();
        await expect(attributeMenu).toBeHidden();

        // Select operator
        const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
        await expect(operatorButton).toBeVisible();
        await operatorButton.click();

        const operatorMap: Record<string, string> = {
            '==': 'is',
            '!=': 'is not',
            in: 'is one of',
            contains: 'contains',
            startsWith: 'starts with',
            endsWith: 'ends with',
        };
        const operatorText = operatorMap[options.operator] || options.operator;
        const operatorMenu = page.locator('[id^="operator-selector-menu"]');
        await expect(operatorMenu).toBeVisible();
        const operatorOption = operatorMenu.locator(`li:has-text("${operatorText}")`).first();
        await expect(operatorOption).toBeVisible();
        await operatorOption.click({force: true});

        // Fill value
        if (options.operator === 'in') {
            // Multi-value operator
            const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            await expect(valueButton).toBeVisible();
            await valueButton.click({force: true});
            const valueInput = page.locator('[id^="value-selector-menu"] input[type="text"]').last();
            await expect(valueInput).toBeVisible();
            await valueInput.fill(options.value);
            await page.keyboard.press('Enter');
            await expect(valueButton).toContainText(options.value);
        } else {
            // Single-value operator
            await fillSingleConditionValue(page, options.value);
        }
    } // end if (clickedAddAttribute)

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        const channelModal = page.locator('.channel-selector-modal, [role="dialog"]').last();
        await expect(channelModal).toBeVisible();

        for (const channelName of options.channels) {
            const searchInput = channelModal.locator('input[type="text"], input[placeholder*="search" i]').last();
            await expect(searchInput).toBeVisible();
            const searched = channelSearchResponse(page, channelName);
            await searchInput.fill(channelName);
            await searched;

            const channelOption = channelModal.getByText(channelName, {exact: false}).first();
            await expect(channelOption).toBeVisible();
            await channelOption.click({force: true});
        }

        const addButton = channelModal.getByRole('button', {name: /^add$|^save$/i});
        await addButton.click();
        await expect(channelModal).toBeHidden();
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
                await expect(headerCheckbox).toBeChecked();
            }
        }
    }

    // Save opens the apply confirmation when channels are assigned; the policy PUT
    // itself is sent from that confirmation, so do not wait for it before Apply.
    const saved = policyWriteResponse(page);
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    // Click "Apply policy" button in confirmation modal (only appears if channels are assigned)
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    const applyVisible = await applyPolicyButton.isVisible({timeout: 3000}).catch(() => false);
    if (applyVisible) {
        // Arm the response interceptor BEFORE the click so we never miss the POST.
        const jobResponsePromise = page
            .waitForResponse((r) => r.url().includes('/api/v4/jobs') && r.request().method() === 'POST', {
                timeout: 10_000,
            })
            .then(async (r) => (r.ok() ? (((await r.json()) as {id?: string}).id ?? null) : null))
            .catch(() => null);

        await applyPolicyButton.click();
        await saved;
        await expect(applyPolicyButton).toBeHidden();

        return jobResponsePromise;
    }

    // No channels assigned — save runs immediately and no sync job is triggered.
    // A validation error (duplicate name) stays on the form, so do not require the list.
    await saved;
    return null;
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
): Promise<string | null> {
    if (!page.url().includes('/membership_policies')) {
        await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'domcontentloaded'});
        await expect(page.getByRole('button', {name: 'Add policy'})).toBeVisible();
    }

    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(options.name);

    // Check if "Add attribute" button is disabled (means no attributes loaded)
    const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
    if (await addAttributeButton.isVisible({timeout: 2000})) {
        const isDisabled = await addAttributeButton.isDisabled();
        if (isDisabled) {
            await page.reload({waitUntil: 'domcontentloaded'});

            const nameInputAfterReload = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await expect(nameInputAfterReload).toBeVisible();
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
        }

        // Select attribute - click the attribute selector for this row
        const attributeButtons = page.locator('[data-testid="attributeSelectorMenuButton"]');
        const attributeButton = attributeButtons.nth(i);
        await expect(attributeButton).toBeVisible();
        await attributeButton.click({force: true});

        // Select the attribute from the menu
        const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
        await expect(attributeMenu).toBeVisible();
        const attributeOption = attributeMenu.locator(`li:has-text("${rule.attribute}")`).first();
        await expect(attributeOption).toBeVisible();
        await attributeOption.click();
        await expect(attributeMenu).toBeHidden();

        // Select operator
        const operatorButtons = page.locator('[data-testid="operatorSelectorMenuButton"]');
        const operatorButton = operatorButtons.nth(i);
        await expect(operatorButton).toBeVisible();
        await operatorButton.click();

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
        const operatorMenu = page.locator('[id^="operator-selector-menu"]');
        await expect(operatorMenu).toBeVisible();
        const operatorOption = operatorMenu.locator(`li:has-text("${operatorText}")`).first();
        await expect(operatorOption).toBeVisible();
        await operatorOption.click({force: true});

        // Enter value - check if it's a text input or select menu
        const valueInput = page.locator('.values-editor__simple-input').nth(i);
        if (await valueInput.isVisible({timeout: 2000})) {
            await valueInput.fill(rule.value);
            await valueInput.press('Tab');
            await expect(valueInput).toHaveValue(rule.value);
        } else {
            // It might be a select/multiselect - click the value selector
            const valueButtons = page.locator('[data-testid="valueSelectorMenuButton"]');
            const valueButton = valueButtons.nth(i);
            if (await valueButton.isVisible({timeout: 2000})) {
                await valueButton.click({force: true});
                const valueMenu = page.locator('[id^="value-selector-menu"]');
                await expect(valueMenu).toBeVisible();

                const valueOption = valueMenu.locator(`li:has-text("${rule.value}")`).first();
                await expect(valueOption).toBeVisible();
                await valueOption.click({force: true});
                await expect(valueButton).toContainText(rule.value);
            }
        }
    }

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();
        const channelModal = page.locator('[role="dialog"], .modal').filter({hasText: /channel/i});
        await expect(channelModal).toBeVisible();

        for (const channelName of options.channels) {
            const searchInput = channelModal.locator('input[placeholder*="Search" i]').first();
            await expect(searchInput).toBeVisible();
            const searched = channelSearchResponse(page, channelName);
            await searchInput.fill(channelName);
            await searched;

            const channelOption = channelModal.getByText(channelName, {exact: false}).first();
            await expect(channelOption).toBeVisible();
            await channelOption.click({force: true});
        }

        const addButton = channelModal.getByRole('button', {name: /^add$|^save$/i});
        await addButton.click();
        await expect(channelModal).toBeHidden();
    }

    // Set auto-add for all channels if autoSync is true
    if (options.autoSync && options.channels && options.channels.length > 0) {
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();
            if (!isChecked) {
                await headerCheckbox.click({force: true});
                await expect(headerCheckbox).toBeChecked();
            }
        }
    }

    // Save opens the confirmation; the policy PUT is sent when Apply is clicked.
    const saved = policyWriteResponse(page);
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    await expect(applyPolicyButton).toBeVisible();

    const jobResponsePromise = page
        .waitForResponse((r) => r.url().includes('/api/v4/jobs') && r.request().method() === 'POST', {timeout: 10_000})
        .then(async (r) => (r.ok() ? (((await r.json()) as {id?: string}).id ?? null) : null))
        .catch(() => null);

    await applyPolicyButton.click();
    await saved;
    await expect(applyPolicyButton).toBeHidden();
    return jobResponsePromise;
}

/**
 * Create advanced policy using CEL Editor (Advanced mode).
 * Returns the sync job ID triggered by "Apply policy", or null when no channels
 * are assigned. Pass to waitForLatestSyncJob for race-safe job polling.
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
    if (!page.url().includes('/membership_policies')) {
        await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'domcontentloaded'});
        await expect(page.getByRole('button', {name: 'Add policy'})).toBeVisible();
    }

    // Click Add policy button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.click();

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(options.name);

    // Switch to Advanced mode — the button can stay disabled until the policy editor
    // finishes loading (slow under parallel CI); wait instead of racing a 2s visibility check.
    const advancedModeButton = page.getByRole('button', {name: /advanced/i});
    if (await advancedModeButton.isVisible({timeout: 5000}).catch(() => false)) {
        await expect(advancedModeButton).toBeEnabled({timeout: 60_000});
        await advancedModeButton.click();
    }

    // Fill CEL expression in the Monaco editor
    // Monaco editor has a visual layer that intercepts clicks, so we need to:
    // 1. Click on the editor container to focus it
    // 2. Use keyboard to clear and type the expression
    const monacoContainer = page.locator('.monaco-editor').first();
    await expect(monacoContainer).toBeVisible();

    // Click on the visible lines area to focus the editor
    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.click({force: true});
    await expect(page.locator('.monaco-editor textarea').first()).toBeFocused();

    // Select all existing content and replace with our expression
    // Use Cmd+A on Mac, Ctrl+A on others
    const isMac = process.platform === 'darwin';
    const expressionChecked = page.waitForResponse(async (r) => {
        if (!r.url().includes('/access_control_policies/cel/check') || r.request().method() !== 'POST') {
            return false;
        }
        try {
            const body = r.request().postDataJSON() as {expression?: string};
            return Boolean(body?.expression?.includes(options.celExpression));
        } catch {
            return false;
        }
    });
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');

    // Type the CEL expression
    await page.keyboard.type(options.celExpression, {delay: 10});
    await expressionChecked;

    // Wait for the "Valid" indicator to appear
    await expect(page.locator('text=Valid').first()).toBeVisible();

    // Assign channels if specified
    if (options.channels && options.channels.length > 0) {
        const addChannelsButton = page.getByRole('button', {name: /add channels/i});
        await addChannelsButton.click();

        // Wait for the modal to appear
        const channelModal = page.locator('[role="dialog"]').filter({hasText: /channel/i});
        await expect(channelModal).toBeVisible();

        for (const channelName of options.channels) {
            // Find search input within the modal
            const searchInput = channelModal.locator('input').first();
            await expect(searchInput).toBeVisible();
            const searched = channelSearchResponse(page, channelName);
            await searchInput.fill(channelName);
            await searched;

            // Click the "Select channel" button (the + button) to add it
            const selectChannelButton = channelModal.getByRole('button', {name: /select channel/i}).first();
            await expect(selectChannelButton).toBeVisible();
            await selectChannelButton.click();
        }

        // Click Add button inside the modal to confirm
        const modalAddButton = channelModal.getByRole('button', {name: 'Add'});
        await modalAddButton.click();
        try {
            await expect(channelModal).toBeHidden();
        } catch {
            await page.keyboard.press('Escape');
            await expect(channelModal).toBeHidden();
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
        // Click the header checkbox to enable auto-add for ALL channels
        const headerCheckbox = page.locator('#auto-add-header-checkbox');

        if (await headerCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await headerCheckbox.isChecked();

            // Only click if we need to enable it
            if (!isChecked) {
                await headerCheckbox.click({force: true});
                await expect(headerCheckbox).toBeChecked();
            }
        }
    }

    // Save policy and confirm
    const saveButton = page.getByRole('button', {name: 'Save'});

    // Make sure Save button is enabled
    await expect(saveButton).toBeEnabled();

    const saved = policyWriteResponse(page);
    await saveButton.click();

    // Check for error message
    const errorMessage = page.locator('text=/Unable to save|errors in the form/i').first();
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    await expect(applyPolicyButton.or(errorMessage)).toBeVisible();
    if (await errorMessage.isVisible().catch(() => false)) {
        const errorText = await errorMessage.textContent();
        // console.error(`❌ Save failed: ${errorText}`);
        throw new Error(`Failed to save policy: ${errorText}`);
    }

    // Arm the response interceptor BEFORE the click so we never miss the POST.
    const jobResponsePromise = page
        .waitForResponse((r) => r.url().includes('/api/v4/jobs') && r.request().method() === 'POST', {timeout: 10_000})
        .then(async (r) => (r.ok() ? (((await r.json()) as {id?: string}).id ?? null) : null))
        .catch(() => null);

    await applyPolicyButton.click();
    await saved;
    await expect(applyPolicyButton).toBeHidden();

    return jobResponsePromise;
}

/**
 * Activate a policy (set active: true)
 */
export async function activatePolicy(client: Client4, policyId: string): Promise<void> {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/activate?active=true`;
    await (client as any).doFetch(url, {method: 'GET'});
}

/**
 * Wait for a sync job to complete.
 *
 * When `expectedJobId` is supplied (obtained from `runSyncJob()` which
 * intercepts the POST /api/v4/jobs response), polls GET /api/v4/jobs/{id}
 * directly — race-free under PW_WORKERS >= 2 because it checks the exact
 * job, not the first row of a shared list.
 *
 * When `expectedJobId` is not supplied, falls back to reading the first row
 * of the UI sync-jobs table (racy under concurrency; avoid when possible by
 * passing the ID returned from `runSyncJob()` or `createBasicPolicy()`).
 *
 * Both paths use `expect.poll` with 500 ms intervals and a 30 s timeout so
 * individual CI jobs that are delayed in the queue don't cause false failures.
 */
export async function waitForLatestSyncJob(
    page: Page,
    _retries?: number,
    expectedJobId?: string | null,
    timeoutMs: number = 90_000,
): Promise<any> {
    // ── Race-safe path: poll the exact job by ID ──────────────────────────
    if (expectedJobId) {
        await expect
            .poll(
                async () => {
                    try {
                        const job: any = await page.evaluate(async (id: string) => {
                            const resp = await fetch(`/api/v4/jobs/${encodeURIComponent(id)}`, {
                                credentials: 'include',
                            });
                            if (!resp.ok) {
                                return {status: `http_${resp.status}`};
                            }
                            return resp.json();
                        }, expectedJobId);
                        const status = (job?.status ?? '').toLowerCase();
                        if (['error', 'failed', 'canceled', 'cancel_requested'].includes(status)) {
                            throw new Error(`Sync job ${expectedJobId} failed: ${status}`);
                        }
                        return status;
                    } catch (err) {
                        if (err instanceof Error && err.message.startsWith('Sync job')) {
                            throw err;
                        }
                        return 'pending'; // network hiccup — keep polling
                    }
                },
                {
                    timeout: timeoutMs,
                    intervals: [500, 500, 500, 1000, 1000, 2000],
                    message: `Sync job ${expectedJobId} did not reach success within ${timeoutMs / 1000} s`,
                },
            )
            .toBe('success');
        return;
    }

    // ── Legacy path: read the first row of the sync-jobs table ───────────
    // RACY under PW_WORKERS >= 2 — use the jobId path when possible.
    await expect
        .poll(
            async () => {
                await page.reload({waitUntil: 'domcontentloaded'});
                await expect(page.locator('table').first()).toBeVisible();
                const latestJobRow = page.locator('tr.clickable').first();
                if (!(await latestJobRow.isVisible({timeout: 3000}).catch(() => false))) {
                    return 'no_jobs';
                }
                const status = (await latestJobRow.locator('td').first().textContent()) ?? '';
                const s = status.trim().toLowerCase();
                if (s === 'error' || s === 'failed') {
                    throw new Error(`Sync job failed with status: ${status.trim()}`);
                }
                return s;
            },
            {
                timeout: 90_000,
                intervals: [2000, 2000, 3000, 3000],
                message: 'Sync job did not complete within 90 s (legacy path)',
            },
        )
        .toBe('success');
}

/**
 * Wait for a policy-specific access_control_sync job to complete.
 *
 * Queries the server API directly with a policy_id filter so it is race-safe
 * under PW_WORKERS >= 2: another shard's sync job cannot be mistaken for ours.
 *
 * Uses `expect.poll` with 500 ms intervals and a 30 s timeout so jobs that are
 * briefly delayed in the queue do not cause spurious failures.
 */
export async function waitForPolicySyncJob(client: Client4, policyId: string, timeoutMs = 60_000): Promise<void> {
    await expect
        .poll(
            async () => {
                try {
                    const jobs: any[] = await (client as any).doFetch(
                        `${client.getBaseRoute()}/jobs/type/access_control_sync?policy_id=${encodeURIComponent(policyId)}&page=0&per_page=5`,
                        {method: 'GET'},
                    );
                    if (!Array.isArray(jobs) || jobs.length === 0) {
                        return 'pending';
                    }
                    // Sort by create_at descending so jobs[0] is the latest.
                    // The API does not guarantee order, so without this sort
                    // jobs[0] can be an older already-successful job, causing
                    // us to return early before the newest sync has finished.
                    jobs.sort((a: any, b: any) => (b.create_at ?? 0) - (a.create_at ?? 0));
                    const status: string = jobs[0].status ?? 'pending';
                    if (status === 'error' || status === 'canceled' || status === 'cancel_requested') {
                        throw new Error(`Policy sync job failed: ${status}`);
                    }
                    return status;
                } catch (err) {
                    if (err instanceof Error && err.message.startsWith('Policy sync job')) {
                        throw err;
                    }
                    return 'pending'; // network hiccup — keep polling
                }
            },
            {
                timeout: timeoutMs,
                intervals: [500, 500, 500, 1000, 1000, 2000],
                message: `Policy sync job for ${policyId} did not reach success within ${timeoutMs / 1000} s`,
            },
        )
        .toBe('success');
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

    // Wait for the Job Details modal to appear
    const jobDetailsModal = page.locator('[role="dialog"], .modal').filter({hasText: 'Job Details'});
    await expect(jobDetailsModal).toBeVisible();

    // Find the search input in the modal
    const searchInput = jobDetailsModal.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 3000});

    // Search for the channel. The job-details list filters in the client on input.
    await searchInput.fill(channelName);
    await expect(searchInput).toHaveValue(channelName);

    // Find and click the channel row to open Channel Membership Changes modal
    const channelRow = jobDetailsModal.locator(`text=${channelName}`).first();

    let added = 0;
    let removed = 0;

    if (await channelRow.isVisible({timeout: 3000})) {
        await channelRow.click();

        // Wait for the Channel Membership Changes modal
        const membershipModal = page.locator('[role="dialog"], .modal').filter({hasText: 'Channel Membership Changes'});

        if (await membershipModal.isVisible({timeout: 3000})) {
            // Parse Added count from the tab: "Added (X)"
            const addedTab = membershipModal.locator('text=/Added \\(\\d+\\)/i').first();
            if (await addedTab.isVisible({timeout: 2000})) {
                const addedText = await addedTab.textContent();
                const addedMatch = addedText?.match(/Added\s*\((\d+)\)/i);
                added = addedMatch ? parseInt(addedMatch[1], 10) : 0;
            }

            // Parse Removed count from the tab: "Removed (X)"
            const removedTab = membershipModal.locator('text=/Removed \\(\\d+\\)/i').first();
            if (await removedTab.isVisible({timeout: 2000})) {
                const removedText = await removedTab.textContent();
                const removedMatch = removedText?.match(/Removed\s*\((\d+)\)/i);
                removed = removedMatch ? parseInt(removedMatch[1], 10) : 0;
            }

            // Close the Channel Membership Changes modal
            const closeButton = membershipModal
                .locator('button[aria-label*="Close" i], .close, button:has-text("×")')
                .first();
            if (await closeButton.isVisible({timeout: 1000})) {
                await closeButton.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(membershipModal).toBeHidden();
        } else {
            // Fallback: parse from the row text
            const channelRowParent = channelRow.locator('..').locator('..');
            const countsText = await channelRowParent.textContent();

            const addedMatch = countsText?.match(/\+(\d+)/);
            const removedMatch = countsText?.match(/-(\d+)/);

            added = addedMatch ? parseInt(addedMatch[1], 10) : 0;
            removed = removedMatch ? parseInt(removedMatch[1], 10) : 0;
        }
    }

    // Close the Job Details modal
    const closeJobDetailsButton = jobDetailsModal
        .locator('button[aria-label*="Close" i], .close, button:has-text("×")')
        .first();
    if (await closeJobDetailsButton.isVisible({timeout: 1000})) {
        await closeJobDetailsButton.click();
    } else {
        await page.keyboard.press('Escape');
    }
    await expect(jobDetailsModal).toBeHidden();

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
        await expect(job2Row).toBeVisible();
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
    const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;

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
                }
                // Wait before retrying
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            } else if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
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
 * Available permissions: 'Download Files' | 'Upload Files' | 'Channel Read Access' | 'Channel Write Access' | 'Manage Channel' | 'Create Burn-on-Read Message'
 * Available roles: 'system_guest' | 'system_user' | 'system_admin' | 'system_bot' (Bot accounts)
 */
export async function createPermissionPolicy(
    page: Page,
    options: {
        name: string;
        celExpression: string;
        permissions: Array<
            | 'Download Files'
            | 'Upload Files'
            | 'Channel Read Access'
            | 'Channel Write Access'
            | 'Manage Channel'
            | 'Create Burn-on-Read Message'
        >;
        role?: 'system_guest' | 'system_user' | 'system_admin' | 'system_bot';
        adminClient?: Client4;
    },
): Promise<void> {
    // Ensure user attributes exist — a parallel test may have deleted all CPA fields,
    // which disables the "Switch to Advanced Mode" button in the permission policy editor.
    if (options.adminClient) {
        await ensureUserAttributes(options.adminClient);
    }

    await navigateToPermissionPoliciesPage(page);

    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await expect(addPolicyButton).toBeVisible();
    await addPolicyButton.click();

    // Fill policy name
    const nameField = page.getByPlaceholder('Add a unique policy name');
    await expect(nameField).toBeVisible();
    await nameField.fill(options.name);

    // Set role if not the default (system_user) using the role dropdown
    if (options.role && options.role !== 'system_user') {
        await page.locator('#pp-role-selector-btn').click();
        const roleOption = page.locator(`#pp-role-option-${options.role}`);
        await expect(roleOption).toBeVisible();
        await roleOption.click();
    }

    // Switch to Advanced (CEL) mode and enter expression.
    // The button is disabled when no user-attribute fields exist. If another test's
    // afterEach deleted all CPA fields between our ensureUserAttributes call and now,
    // re-create them and reload the "Add policy" form before clicking.
    const switchBtn = page.getByRole('button', {name: 'Switch to Advanced Mode'});
    if (await switchBtn.isDisabled()) {
        if (options.adminClient) {
            await ensureUserAttributes(options.adminClient);
        }
        await navigateToPermissionPoliciesPage(page);
        const addPolicyRetry = page.getByRole('button', {name: 'Add policy'});
        await expect(addPolicyRetry).toBeVisible();
        await addPolicyRetry.click();
        // Re-fill policy name and role after the form reload.
        const nameFieldRetry = page.getByPlaceholder('Add a unique policy name');
        await expect(nameFieldRetry).toBeVisible();
        await nameFieldRetry.fill(options.name);
        if (options.role && options.role !== 'system_user') {
            await page.locator('#pp-role-selector-btn').click();
            const roleOption = page.locator(`#pp-role-option-${options.role}`);
            await expect(roleOption).toBeVisible();
            await roleOption.click();
        }
    }
    await expect(switchBtn).toBeEnabled({timeout: 10000});
    await switchBtn.click();

    const monacoContainer = page.locator('.monaco-editor').first();
    await expect(monacoContainer).toBeVisible();

    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.click({force: true});
    await expect(page.locator('.monaco-editor textarea').first()).toBeFocused();

    const isMac = process.platform === 'darwin';
    const expressionChecked = page.waitForResponse(async (r) => {
        if (!r.url().includes('/access_control_policies/cel/check') || r.request().method() !== 'POST') {
            return false;
        }
        try {
            const body = r.request().postDataJSON() as {expression?: string};
            return Boolean(body?.expression?.includes(options.celExpression));
        } catch {
            return false;
        }
    });
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.keyboard.type(options.celExpression, {delay: 10});
    await expressionChecked;
    await expect(page.locator('text=Valid').first()).toBeVisible();

    // Add each permission via the menu.
    // Items are keyed by their action value, e.g. pp-add-permission-download_file_attachment.
    const permissionIdMap: Record<string, string> = {
        'Download Files': 'pp-add-permission-download_file_attachment',
        'Upload Files': 'pp-add-permission-upload_file_attachment',
        'Channel Read Access': 'pp-add-permission-channel_read_access',
        'Channel Write Access': 'pp-add-permission-channel_write_access',
        'Manage Channel': 'pp-add-permission-channel_management_access',
        'Create Burn-on-Read Message': 'pp-add-permission-create_burn_on_read_post',
    };
    for (const permission of options.permissions) {
        await page.getByRole('button', {name: 'Add permission'}).click();
        const permissionItem = page.locator(`#${permissionIdMap[permission]}`);
        await expect(permissionItem).toBeVisible();
        await permissionItem.click();
    }

    // Channel Read Access and Manage Channel confirm before the PUT. Register first
    // so either the immediate save or the confirmation click is observed.
    const saved = policyWriteResponse(page);
    await page.getByRole('button', {name: 'Save'}).last().click();

    // A policy with Channel Read Access or Manage Channel shows a confirmation dialog
    // before saving. Channel Write Access and file-only policies save straight through,
    // so the dialog is optional.
    if (options.permissions.includes('Channel Read Access') || options.permissions.includes('Manage Channel')) {
        const confirmModal = page.locator('#channel-access-confirm-modal');
        await expect(confirmModal).toBeVisible();
        await confirmModal.getByRole('button', {name: 'Save policy'}).click();
    }

    await saved;
    await expect(page.getByRole('button', {name: 'Add policy'})).toBeVisible();
}

/**
 * Navigate to Permission Policies and ensure the route is available.
 * Throws a clear error when the webapp bundle does not include this page.
 */
export async function navigateToPermissionPoliciesPage(page: Page): Promise<void> {
    await page.goto('/admin_console/system_attributes/permission_policies', {waitUntil: 'domcontentloaded'});

    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    try {
        await expect(addPolicyButton).toBeVisible();
    } catch (err) {
        if (page.url().includes('/admin_console/about/license')) {
            throw new Error(
                'Permission Policies page is unavailable and redirected to License. Rebuild and run webapp from a branch that includes the permission policies route before running ABAC tests.',
            );
        }
        throw err;
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
/**
 * Rewrite the CEL expression on every rule of an existing permission policy.
 *
 * API rather than the CEL editor: SavePolicy publishes permission_policy_updated whichever
 * surface issued the change, and driving the admin UI would test the editor instead.
 *
 * Revoke by narrowing the expression, never by removing an action. An action no rule grants is
 * implicitly allowed, so dropping one widens access instead of withdrawing it.
 */
export async function updatePermissionPolicyExpression(
    client: Client4,
    policyName: string,
    expression: string,
): Promise<void> {
    const policyId = await getPolicyIdByName(client, policyName);
    expect(policyId, `Could not find permission policy "${policyName}" to update`).toBeTruthy();

    const policy = await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policyId}`, {
        method: 'GET',
    });

    policy.rules = (policy.rules || []).map((rule: any) => ({...rule, expression}));

    await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify(policy),
    });
}

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
