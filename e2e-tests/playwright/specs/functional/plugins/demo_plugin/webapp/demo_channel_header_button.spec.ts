// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

test('should open right-hand sidebar when demo plugin App Bar button is clicked', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Locate and click the demo plugin button in the right App Bar
    await expect(channelsPage.appBar.demoPluginButton).toBeVisible();

    // 4. Click the App Bar button
    await channelsPage.appBar.demoPluginButton.click();

    // 5. Verify the RHS opens with expected content
    const rhsPanel = channelsPage.page.getByRole('region', {name: 'Demo Plugin'});
    await expect(rhsPanel).toBeVisible();

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

    // 6. Verify pop-out buttons are present and enabled (but do NOT click — pop-out crashes in test env)
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out RHS'})).toBeEnabled();
    await expect(rhsPanel.getByRole('button', {name: 'Pop Out via useEffect'})).toBeEnabled();

    // 7. Navigate to the /roottest custom route link and verify the page content
    await rhsPanel.getByText('/plug/com.mattermost.demo-plugin/roottest').click();
    await expect(channelsPage.page).toHaveURL(/\/plug\/com\.mattermost\.demo-plugin\/roottest$/);
    await expect(channelsPage.page.getByText('Demo plugin route.')).toBeVisible();
    await channelsPage.page.goBack();

    // 8. Close the RHS and verify it dismisses
    const rhsPanelAfterNav = channelsPage.page.getByRole('region', {name: 'Demo Plugin'});
    await rhsPanelAfterNav.getByRole('button', {name: 'Close'}).click();
    await expect(rhsPanelAfterNav).not.toBeVisible();
});
