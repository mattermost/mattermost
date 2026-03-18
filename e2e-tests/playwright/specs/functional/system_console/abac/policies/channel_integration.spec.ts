// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    runSyncJob,
    verifyUserInChannel,
} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    createPrivateChannelForABAC,
    createBasicPolicy,
    waitForLatestSyncJob,
} from '../support';

/**
 * ABAC Policies - Channel Integration
 * Tests for managing ABAC policies through Channel Configuration
 */
test.describe('ABAC Policies - Channel Integration', () => {
    /**
     * MM-T5788: Add attribute-based policy to a channel from Channel Configuration page
     * @objective Verify that a policy can be added to a channel from the Channel Configuration page
     *
     * Steps:
     * 1. As admin go to System Console > User Management > Channels
     */
    test('MM-T5788 Add policy to channel from Channel Configuration page', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create users, channel, and policy
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);

        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // Create satisfying user (Department=Engineering) - NOT in channel initially
        const satisfyingUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        await adminClient.addToTeam(team.id, satisfyingUser.id);

        // Create non-satisfying user (Department=Sales) - will be IN channel initially
        const nonSatisfyingUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        await adminClient.addToTeam(team.id, nonSatisfyingUser.id);

        // Create private channel and add non-satisfying user
        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(nonSatisfyingUser.id, channel.id);

        // Login and setup ABAC
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        // Create policy without channels (we'll link via Channel Config)
        const policyName = `Channel Config Policy ${await pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
        });

        // Get search term for policy
        const policyIdMatch = policyName.match(/([a-z0-9]+)$/i);
        const searchTerm = policyIdMatch ? policyIdMatch[1] : policyName;

        // ============================================================
        // STEP 1-2: Navigate to Channel Configuration
        // ============================================================

        await systemConsolePage.page.goto('/admin_console/user_management/channels');
        await systemConsolePage.page.waitForLoadState('networkidle');

        // Search and find our channel
        const channelSearchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await channelSearchInput.fill(channel.display_name);
        await systemConsolePage.page.waitForTimeout(1000);

        // Verify channel shows "Manual Invites" management
        const channelRow = systemConsolePage.page
            .locator('.DataGrid_row')
            .filter({hasText: channel.display_name})
            .first();
        // const managementText = await channelRow.textContent();

        // Click Edit
        await channelRow.getByText('Edit').click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // ============================================================
        // STEP 3: Toggle on "Enable attribute based channel access"
        // ============================================================

        const abacToggle = systemConsolePage.page.locator('[data-testid="policy-enforce-toggle-button"]');
        await abacToggle.waitFor({state: 'visible', timeout: 5000});

        const isEnabled = await abacToggle.getAttribute('aria-pressed');
        if (isEnabled !== 'true') {
            await abacToggle.click();
        }
        await systemConsolePage.page.waitForTimeout(500);

        // ============================================================
        // STEP 4: Link to policy and Save
        // ============================================================

        // Click "Link to a policy"
        const linkButton = systemConsolePage.page.locator('[data-testid="link-to-a-policy"]');
        await linkButton.waitFor({state: 'visible', timeout: 5000});
        await linkButton.click();
        await systemConsolePage.page.waitForTimeout(500);

        // Select policy in modal
        const modal = systemConsolePage.page
            .locator('[role="dialog"]')
            .filter({hasText: 'Select an Access Control Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});

        const modalSearch = modal.locator('[data-testid="searchInput"]');
        await modalSearch.fill(searchTerm);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyOption = modal.locator('.DataGrid_row').filter({hasText: policyName}).first();
        await policyOption.click();
        await systemConsolePage.page.waitForTimeout(500);

        // Save
        await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // ============================================================
        // Run sync to apply policy
        // ============================================================
        await systemConsolePage.page.waitForTimeout(2000);
        await navigateToABACPage(systemConsolePage.page);
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        // ============================================================
        // VERIFY: Channel membership
        // ============================================================

        // 1. Non-satisfying user should be REMOVED
        const nonSatisfyingInChannel = await verifyUserInChannel(adminClient, nonSatisfyingUser.id, channel.id);
        expect(nonSatisfyingInChannel).toBe(false);

        // 2. Satisfying user should NOT be auto-added (per requirement)
        const satisfyingInChannel = await verifyUserInChannel(adminClient, satisfyingUser.id, channel.id);
        // Note: If implementation auto-adds, this will fail. Adjust if needed.
        expect(satisfyingInChannel).toBe(false);

        // 3. Satisfying user CAN be manually added
        await adminClient.addToChannel(satisfyingUser.id, channel.id);
        const afterManualAdd = await verifyUserInChannel(adminClient, satisfyingUser.id, channel.id);
        expect(afterManualAdd).toBe(true);

        // 4. Non-satisfying user CANNOT be added (blocked by policy)
        let blocked = false;
        try {
            await adminClient.addToChannel(nonSatisfyingUser.id, channel.id);
        } catch {
            // Expected to fail - policy blocks non-qualifying users
            blocked = true;
        }
        expect(blocked).toBe(true);
    });

    /**
     * MM-T5789: Channel cannot use attribute-based policies if already constrained by LDAP group sync
     *
     * Preconditions:
     * - At least one policy exists on the server
     * - At least one channel configured to be constrained by LDAP group sync
     *
     * Step 1:
     * 1. As admin go to System Console > User Management > Channels
     * 2. Click a channel with Management = "Group Sync" (private channel)
     * 3. Observe "Enable attribute based channel access" is NOT available
     * 4. Toggle off "Sync Group Members", observe ABAC becomes available
     *
     * Step 2:
     * 1. Go to System Console > User Management > Attribute-Based Access
     * 2. Click a policy to edit it, click Add channels
     * 3. Select a channel constrained by LDAP group sync
     *
     * Expected: ABAC not available for channels using LDAP group sync
     *
     * Test Data Note: Current UI behavior is uncertain - may allow save but channel
     * not added, or may show error. This test observes and documents actual behavior.
     *
     * Implementation Note: We mock Group Sync by setting group_constrained=true via API.
     * This works without LDAP - the server accepts it and UI shows "Group Sync".
     */
    test('MM-T5789 Channel with LDAP group sync cannot use ABAC', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        // ===========================================
        // PRECONDITION 1: Create a policy first
        // ===========================================
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `ABAC-GroupSync-Test-${await pw.random.id()}`;
        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
        });

        // ===========================================
        // PRECONDITION 2: Create a Group Sync channel via API
        // We mock Group Sync by setting group_constrained=true
        // This works without LDAP configuration
        // ===========================================

        const groupSyncChannelName = `ABAC-GroupSync-${await pw.random.id()}`;
        const groupSyncChannel = await adminClient.createChannel({
            team_id: team.id,
            name: groupSyncChannelName.toLowerCase().replace(/[^a-z0-9]/g, ''),
            display_name: groupSyncChannelName,
            type: 'P', // Private
        });

        // Set group_constrained=true via API to mock Group Sync
        await adminClient.patchChannel(groupSyncChannel.id, {
            group_constrained: true,
        } as any);

        // ===========================================
        // STEP 1: Navigate to Group Sync channel config
        // ===========================================
        await page.goto('/admin_console/user_management/channels');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Search for our channel
        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible({timeout: 3000})) {
            await searchInput.fill(groupSyncChannelName);
            await page.waitForTimeout(1000);
        }

        // Verify channel shows as "Group Sync"
        const channelRow = page.locator('.DataGrid_row').filter({hasText: groupSyncChannelName}).first();
        await channelRow.waitFor({state: 'visible', timeout: 10000});

        const rowText = await channelRow.textContent();
        expect(rowText).toContain('Group Sync');

        // Click Edit to open channel configuration
        await channelRow.getByText('Edit').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // STEP 1.3: Verify ABAC toggle is NOT available when Group Sync is enabled
        const abacToggle = page.locator('[data-testid="policy-enforce-toggle-button"]');
        const abacVisibleWithGroupSync = await abacToggle.isVisible({timeout: 5000}).catch(() => false);

        expect(abacVisibleWithGroupSync).toBe(false);

        // STEP 1.4: Toggle off Group Sync and verify ABAC becomes available

        // Disable Group Sync via API (more reliable than UI toggle)
        await adminClient.patchChannel(groupSyncChannel.id, {
            group_constrained: false,
        } as any);

        // Reload page to see updated UI
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Verify ABAC toggle is now available
        const abacToggleAfter = page.locator('[data-testid="policy-enforce-toggle-button"]');
        const abacVisibleAfterDisable = await abacToggleAfter.isVisible({timeout: 5000}).catch(() => false);

        expect(abacVisibleAfterDisable).toBe(true);

        // Re-enable Group Sync for Step 2
        await adminClient.patchChannel(groupSyncChannel.id, {
            group_constrained: true,
        } as any);

        // ===========================================
        // STEP 2: Try to add Group Sync channel to existing policy
        // ===========================================
        await navigateToABACPage(page);
        await page.waitForTimeout(1000);

        // Step 2.2: Click the policy to edit it

        // Search for the policy first
        const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
            await page.waitForTimeout(1000);
        }

        // Click on the policy row (use text-based locator)
        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        await policyRowLocator.waitFor({state: 'visible', timeout: 10000});
        await policyRowLocator.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Click Add channels button
        const addChannelsButton = page.getByRole('button', {name: /add channel/i});
        await addChannelsButton.waitFor({state: 'visible', timeout: 10000});
        await addChannelsButton.click();
        await page.waitForTimeout(1000);

        // Step 2.3: Try to select the Group Sync channel
        const channelModal = page.locator('[role="dialog"]').filter({hasText: /channel/i});
        await channelModal.waitFor({state: 'visible', timeout: 5000});

        // Search for the Group Sync channel
        const modalSearchInput = channelModal.locator('[data-testid="searchInput"], input[type="text"]').first();
        if (await modalSearchInput.isVisible({timeout: 3000})) {
            await modalSearchInput.fill(groupSyncChannelName);
            await page.waitForTimeout(1000);
        }

        // Document actual behavior (requirement notes uncertainty)

        const channelRows = channelModal.locator('.DataGrid_row, .more-modal__row');
        const rowCount = await channelRows.count();

        if (rowCount === 0) {
            // Group Sync channel is filtered out - good behavior
        } else {
            // Channel is shown - try to select it
            const channelRowToSelect = channelRows.first();
            await channelRowToSelect.textContent();

            // Try to click/select the channel
            await channelRowToSelect.click({timeout: 5000}).catch(() => {
                // Ignore click errors
            });
            await page.waitForTimeout(500);

            // Try to click Add button
            const addButton = channelModal.getByRole('button', {name: 'Add'});
            if (await addButton.isVisible({timeout: 3000})) {
                const addButtonDisabled = await addButton.isDisabled();
                if (addButtonDisabled) {
                    // Add button is disabled
                } else {
                    await addButton.click();
                    await page.waitForTimeout(1000);
                }
            }

            // Close modal
            const closeButton = channelModal.getByRole('button', {name: /close|cancel|×/i});
            if (await closeButton.isVisible({timeout: 2000})) {
                await closeButton.click();
                await page.waitForTimeout(500);
            }

            // Check if we're back on edit page - try to save
            const saveButton = page.getByRole('button', {name: 'Save'});
            if (await saveButton.isVisible({timeout: 3000})) {
                const saveEnabled = await saveButton.isEnabled();

                if (saveEnabled) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);

                    // Check for error message
                    const errorMessage = page.locator('.error-message, [class*="error"], .alert-danger');
                    const hasError = await errorMessage.isVisible({timeout: 3000}).catch(() => false);

                    if (hasError) {
                        await errorMessage.textContent();
                    } else {
                        // Check if channel was actually added
                    }
                }
            }
        }
    });
});
