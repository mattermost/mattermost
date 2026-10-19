// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

// The plugin's LinkTooltip component only renders for links whose hostname is example.com
// or a subdomain of it — any other hostname renders nothing (returns null).
test('should show custom tooltip when hovering an example.com link', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Post a message containing an example.com link
    await channelsPage.centerView.postCreate.input.fill('Check out https://example.com for details');
    await channelsPage.centerView.postCreate.sendMessage();

    // 4. Hover the rendered link
    const lastPost = await channelsPage.centerView.getLastPost();
    const link = lastPost.container.getByRole('link', {name: 'https://example.com'});
    await expect(link).toBeVisible();
    await link.hover();

    // 5. Confirm the expanded custom tooltip renders with all of its content
    await expect(channelsPage.page.getByText('This is a custom tooltip from the Demo Plugin')).toBeVisible();
    await expect(channelsPage.page.getByTestId('demo-tooltip-title-link')).toHaveText('Demo Link Preview');
    await expect(channelsPage.page.getByTestId('demo-tooltip-shared-via-link')).toHaveText('example.com');
    await expect(channelsPage.page.getByTestId('demo-tooltip-description-link')).toHaveText('the original page');
});

test('should not show the custom tooltip for a non-example.com link', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Post a message containing a non-example.com link
    await channelsPage.centerView.postCreate.input.fill('Also see https://mattermost.com for info');
    await channelsPage.centerView.postCreate.sendMessage();

    // 4. Hover the rendered link
    const lastPost = await channelsPage.centerView.getLastPost();
    const link = lastPost.container.getByRole('link', {name: 'https://mattermost.com'});
    await expect(link).toBeVisible();
    await link.hover();

    // 5. Confirm the demo plugin's custom tooltip does not render. No prior positive
    // assertion exists to race against here, so the default expect timeout is acceptable.
    await expect(channelsPage.page.getByText('This is a custom tooltip from the Demo Plugin')).not.toBeVisible();
});
