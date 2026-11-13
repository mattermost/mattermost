// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ensureTestWebappPlugins,
    expect,
    getAdminClient,
    postAuthTestPluginId,
    removeTestWebappPlugins,
    test,
} from '@mattermost/playwright-lib';

test.afterAll(async () => {
    await removeTestWebappPlugins();
});

/**
 * @objective Verify a multi-word plugin name in the page header stays on one line when the System Console search highlights part of it
 */
test(
    'MM-56489 plugin settings header keeps its name intact when highlighted by the sidebar search',
    {tag: '@system_console'},
    async ({pw}) => {
        await ensureTestWebappPlugins();
        const {adminUser} = await pw.initSetup();
        const {adminClient} = await getAdminClient();
        const pluginName = (await adminClient.getPlugins()).active.find((p) => p.id === postAuthTestPluginId)!.name;

        // # Search the System Console for the first word of the plugin name and open its settings page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.search('E2E');
        await systemConsolePage.sidebar.container.getByRole('link', {name: pluginName}).click();

        // * Verify the search term is highlighted in the header
        const header = systemConsolePage.header.title;
        await expect(header.locator('mark').first()).toHaveText('E2E');

        // * Verify the highlighted name renders as one run of text rather than being split apart
        await expect.poll(() => header.evaluate((el: HTMLElement) => el.innerText)).toContain(pluginName);
    },
);
