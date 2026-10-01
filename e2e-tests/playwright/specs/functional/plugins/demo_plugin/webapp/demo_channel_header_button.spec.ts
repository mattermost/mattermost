// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should open right-hand sidebar when demo plugin App Bar button is clicked', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // * Verify the demo plugin button is visible in the right App Bar
    await expect(channelsPage.appBar.demoPluginButton).toBeVisible();

    // # Click the App Bar button
    await channelsPage.appBar.demoPluginButton.click();

    // * Verify the RHS opens with expected content
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
