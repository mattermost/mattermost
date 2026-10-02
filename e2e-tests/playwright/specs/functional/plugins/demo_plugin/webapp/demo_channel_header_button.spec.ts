// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

test('should open right-hand sidebar when demo plugin App Bar button is clicked', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Click the App Bar button and wait for the RHS to open (with reload + retry if the
    // plugin is transiently unavailable, e.g. during a concurrent plugin_crash.spec.ts
    // recovery cycle — the App Bar icon can briefly disappear or no-op mid reconnect)
    const rhsPanel = channelsPage.page.getByRole('region', {name: 'Demo Plugin'});
    for (let attempt = 0; attempt < 4; attempt++) {
        await expect(channelsPage.appBar.demoPluginButton).toBeVisible();
        await channelsPage.appBar.demoPluginButton.click();
        try {
            await expect(rhsPanel).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            await channelsPage.page.reload();
            await channelsPage.toBeVisible();
        }
    }

    // * Verify the RHS opens with expected content
    await expect(
        rhsPanel.getByText('You have triggered the right-hand sidebar component of the demo plugin.', {exact: true}),
    ).toBeVisible();
    await expect(rhsPanel.getByText('This is the English String', {exact: true})).toBeVisible();

    // Custom route links — rendered as plain <a> tags with no href, text content is the path
    await expect(rhsPanel.getByText('/plug/com.mattermost.demo-plugin/roottest')).toBeVisible();
    await expect(rhsPanel.getByText(/com\.mattermost\.demo-plugin\/teamtest/)).toBeVisible();

    // Pop Out section
    await expect(rhsPanel.getByText('Pop Out RHS Demo', {exact: true})).toBeVisible();
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out RHS'})).toBeVisible();
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out via useEffect'})).toBeVisible();

    // * Verify pop-out buttons are present and enabled (but do NOT click — pop-out crashes in test env)
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out RHS'})).toBeEnabled();
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out via useEffect'})).toBeEnabled();

    // # Navigate to the /roottest custom route link
    await rhsPanel.getByText('/plug/com.mattermost.demo-plugin/roottest').click();

    // * Verify the route page content
    await expect(channelsPage.page).toHaveURL(/\/plug\/com\.mattermost\.demo-plugin\/roottest$/);
    await expect(channelsPage.page.getByText('Demo plugin route.')).toBeVisible();
    await channelsPage.page.goBack();

    // # Close the RHS
    const rhsPanelAfterNav = channelsPage.page.getByRole('region', {name: 'Demo Plugin'});
    await rhsPanelAfterNav.getByRole('button', {name: 'Close'}).click();

    // * Verify it dismisses
    await expect(rhsPanelAfterNav).not.toBeVisible();
});
