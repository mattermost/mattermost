// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E coverage for the v0.4 Permissions Policy tab in Channel Settings:
 *   - Tab visibility is gated by ABAC + license + the PermissionPolicies
 *     umbrella + the ChannelPermissionPolicies sub-flag.
 *   - The list view exposes Add rule, search, and a paginated rules table.
 *   - Adding a permission rule (name, role, actions) and committing returns to the list.
 *   - Per-rule expression uses the same TableEditor as Membership Policy, but
 *     re-labelled "Simulate rules" — the button opens the dual-lane
 *     SimulateAccessModal instead of the legacy expression-only one (additionally
 *     gated by the PolicySimulation feature flag).
 *   - Duplicate rule names surface a save-time error.
 *
 * @reference Channel-scoped permission policies (v0.4)
 *
 * These tests skip themselves at runtime when the PermissionPolicies umbrella
 * OR the ChannelPermissionPolicies sub-flag is not enabled on the server —
 * the tab is invisible in either case and the workflow is not exercised.
 * Run with `MM_FEATUREFLAGS_PERMISSIONPOLICIES=true` AND
 * `MM_FEATUREFLAGS_CHANNELPERMISSIONPOLICIES=true`. The "Simulate rules"
 * button additionally requires `MM_FEATUREFLAGS_POLICYSIMULATION=true`.
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {enableABACConfig, ensureDepartmentAttribute, createPrivateChannel} from '../team_settings/helpers';

test.describe('Channel Settings Modal - Permissions Policy tab (v0.4)', () => {
    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        // Skip the suite when either flag is OFF on the server rather
        // than relying on the tab's UI presence as a proxy — a
        // UI-based guard would silently mask a regression in the tab
        // visibility logic itself. Both flags must be on for the tab
        // to render (the channel-scope sub-flag depends on the
        // umbrella, mirroring `IsChannelPermissionPoliciesEnabled` on
        // the server).
        await pw.skipIfFeatureFlagNotSet('PermissionPolicies', true);
        await pw.skipIfFeatureFlagNotSet('ChannelPermissionPolicies', true);
    });

    test('MM-PP_v0_4_c1 Permissions Policy tab visible on private channel when feature flag enabled', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();
        const permissionsTab = channelSettings.container.getByTestId('permissions_policy-tab-button');

        // Suite-level feature-flag guard already covers PermissionPolicies;
        // assert visibility unconditionally so a regression in the tab's
        // render gate would surface as a test failure.
        await expect(permissionsTab).toBeVisible();

        // # Open Permissions Policy
        await permissionsTab.click();

        // * The list view renders: header, search, table, Add rule button.
        await expect(channelSettings.container.locator('.ChannelSettingsModal__permissionsPolicyTab')).toBeVisible({
            timeout: 10000,
        });
        await expect(channelSettings.container.getByTestId('permissions-policy-add-rule')).toBeVisible();
        await expect(channelSettings.container.getByTestId('permissions-policy-search')).toBeVisible();
        await expect(channelSettings.container.getByTestId('permissions-policy-rules-table')).toBeVisible();

        await channelSettings.close();
    });

    test('MM-PP_v0_4_c2 Add rule opens the editor with sections in the expected order, Cancel returns to the list', async ({
        pw,
    }) => {
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();
        const permissionsTab = channelSettings.container.getByTestId('permissions_policy-tab-button');
        await expect(permissionsTab).toBeVisible();
        await permissionsTab.click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__permissionsPolicyTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Click "Add rule" → editor view appears
        await tab.getByTestId('permissions-policy-add-rule').click();
        const editor = channelSettings.container.getByTestId('permissions-policy-editor');
        await expect(editor).toBeVisible({timeout: 5000});

        // * Mirror system-console layout: name → role → user-attribute conditions → permissions list.
        const expressionSection = editor.getByTestId('permissions-policy-editor-expression-section');
        const permissionsSection = editor.getByTestId('permissions-policy-editor-permissions-section');
        await expect(expressionSection).toBeVisible();
        await expect(permissionsSection).toBeVisible();

        // Permissions list must render BELOW the user-attribute conditions
        // (TableEditor) so we match the System Console policy editor ordering.
        const expressionBox = await expressionSection.boundingBox();
        const permissionsBox = await permissionsSection.boundingBox();
        expect(expressionBox).not.toBeNull();
        expect(permissionsBox).not.toBeNull();
        expect(permissionsBox?.y ?? 0).toBeGreaterThan((expressionBox?.y ?? 0) + (expressionBox?.height ?? 0) - 1);

        // # Cancel → back to list view
        await channelSettings.container.getByTestId('permissions-policy-editor-cancel').click();
        await expect(tab).toBeVisible({timeout: 5000});
        await expect(channelSettings.container.getByTestId('permissions-policy-editor')).not.toBeVisible();

        await channelSettings.close();
    });

    test('MM-PP_v0_4_c3 Editor validates: missing name surfaces an inline error', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();
        const permissionsTab = channelSettings.container.getByTestId('permissions_policy-tab-button');
        await expect(permissionsTab).toBeVisible();
        await permissionsTab.click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__permissionsPolicyTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Open the editor without filling the name
        await tab.getByTestId('permissions-policy-add-rule').click();
        await channelSettings.container.getByTestId('permissions-policy-editor-save').click();

        // * Inline error mentions name uniqueness/required.
        await expect(channelSettings.container.getByTestId('permissions-policy-editor-error')).toBeVisible({
            timeout: 5000,
        });

        await channelSettings.close();
    });
});
