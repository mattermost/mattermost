// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ensureTestWebappPlugins,
    expect,
    getAdminClient,
    postAuthTestPluginId,
    preAuthTestPluginId,
    removeTestWebappPlugins,
    test,
} from '@mattermost/playwright-lib';

test.afterAll(async () => {
    const {adminClient} = await getAdminClient();
    await removeTestWebappPlugins();
    await adminClient.patchConfig({PluginSettings: {RestrictUnauthenticatedWebappPlugins: true}});
});

/**
 * @objective Verify a system admin can turn the restriction on webapp plugins available before login off and on from Plugin Management
 */
test(
    'system admin can toggle restricting webapp plugins available before login',
    {tag: '@system_console'},
    async ({pw}) => {
        // # Install the test plugins with the restriction on
        await ensureTestWebappPlugins();
        const {adminClient, adminUser} = await pw.initSetup();
        await adminClient.patchConfig({PluginSettings: {RestrictUnauthenticatedWebappPlugins: true}});

        const anonymousPluginIds = async () => {
            const response = await pw.loginPage.page.request.get('/api/v4/plugins/webapp', {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            expect(response.ok()).toBe(true);
            const plugins: Array<{id: string}> = await response.json();
            return plugins.map((p) => p.id).filter((id) => id === preAuthTestPluginId || id === postAuthTestPluginId);
        };

        // # Open Plugin Management as a system admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.gotoPluginManagement();
        const pluginManagement = systemConsolePage.pluginManagement;

        // * Verify the setting is shown as true with help text about webapp.pre_auth
        await expect(pluginManagement.restrictUnauthenticatedWebappPluginsTrue).toBeChecked();
        await expect(pluginManagement.restrictUnauthenticatedWebappPluginsHelpText).toContainText('webapp.pre_auth');

        // # Set it to false and save
        await pluginManagement.restrictUnauthenticatedWebappPluginsFalse.check();
        await pluginManagement.save();

        // * Verify the config is saved and every plugin is listed to unauthenticated requests
        expect((await adminClient.getConfig()).PluginSettings.RestrictUnauthenticatedWebappPlugins).toBe(false);
        expect((await anonymousPluginIds()).sort()).toEqual([postAuthTestPluginId, preAuthTestPluginId].sort());

        // # Reload, then set it back to true and save
        await systemConsolePage.gotoPluginManagement();
        await expect(pluginManagement.restrictUnauthenticatedWebappPluginsFalse).toBeChecked();
        await pluginManagement.restrictUnauthenticatedWebappPluginsTrue.check();
        await pluginManagement.save();

        // * Verify the config is saved and only the pre-auth plugin is listed to unauthenticated requests
        expect((await adminClient.getConfig()).PluginSettings.RestrictUnauthenticatedWebappPlugins).toBe(true);
        expect(await anonymousPluginIds()).toEqual([preAuthTestPluginId]);
    },
);
