// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    openSystemConsoleSection,
    Api,
    ensureTestWebappPlugins,
    expect,
    getAdminClient,
    postAuthTestPluginId,
    preAuthTestPluginId,
    removeTestWebappPlugins,
    settle,
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
    async ({page, pw}) => {
        // # Install the test plugins with the restriction on
        await ensureTestWebappPlugins();
        const {adminClient, adminUser} = await pw.initSetup();
        await adminClient.patchConfig({PluginSettings: {RestrictUnauthenticatedWebappPlugins: true}});

        const anonymousPluginIds = async () => {
            const response = await page.request.get('/api/v4/plugins/webapp', {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            expect(response.ok()).toBe(true);
            const plugins: Array<{id: string}> = await response.json();
            return plugins.map((p) => p.id).filter((id) => id === preAuthTestPluginId || id === postAuthTestPluginId);
        };

        // # Open Plugin Management as a system admin
        const {app} = await pw.testBrowser.login(adminUser);
        await openSystemConsoleSection(app, 'plugins/plugin_management');
        const setting = app.admin.setting('restrictUnauthenticatedWebappPlugins');

        // * Verify the setting is shown as true with help text about webapp.pre_auth
        await expect(setting.trueRadio).toBeChecked();
        await expect(setting.helpText).toContainText('webapp.pre_auth');

        // # Set it to false and save
        await setting.falseRadio.check();
        await expect(setting.falseRadio).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // * Verify the config is saved and every plugin is listed to unauthenticated requests
        expect((await adminClient.getConfig()).PluginSettings.RestrictUnauthenticatedWebappPlugins).toBe(false);
        expect((await anonymousPluginIds()).sort()).toEqual([postAuthTestPluginId, preAuthTestPluginId].sort());

        // # Reload, then set it back to true and save
        await openSystemConsoleSection(app, 'plugins/plugin_management');
        await expect(setting.falseRadio).toBeChecked();
        await setting.trueRadio.check();
        await expect(setting.trueRadio).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        await expect(app.admin.saveButton).toBeSaved();

        // * Verify the config is saved and only the pre-auth plugin is listed to unauthenticated requests
        expect((await adminClient.getConfig()).PluginSettings.RestrictUnauthenticatedWebappPlugins).toBe(true);
        expect(await anonymousPluginIds()).toEqual([preAuthTestPluginId]);
    },
);
