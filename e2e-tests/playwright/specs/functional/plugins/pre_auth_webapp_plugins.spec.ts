// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    ensureTestWebappPlugins,
    expect,
    getAdminClient,
    postAuthTestPluginId,
    preAuthTestPluginId,
    removeTestWebappPlugins,
    test,
    testWebappPluginMarkerTestId,
    testWebappPluginRoute,
} from '@mattermost/playwright-lib';

type WebappPluginsResponse = Array<{id: string; [key: string]: unknown}>;

async function setRestriction(value: boolean) {
    const {adminClient} = await getAdminClient();
    await adminClient.patchConfig({PluginSettings: {RestrictUnauthenticatedWebappPlugins: value}});
}

async function getWebappPluginsAnonymously(page: Page): Promise<WebappPluginsResponse> {
    const response = await page.request.get('/api/v4/plugins/webapp', {
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    });
    expect(response.ok()).toBe(true);
    return response.json();
}

function testPluginIds(plugins: WebappPluginsResponse) {
    return plugins
        .map((p) => p.id)
        .filter((id) => id === preAuthTestPluginId || id === postAuthTestPluginId)
        .sort();
}

// Lets a test detect a full page reload: the flag lives on `window`, so a reload clears it.
async function markWindow(page: Page) {
    await page.evaluate(() => {
        (window as any).e2eNoReloadMarker = true;
    });
}

async function expectWindowNotReloaded(page: Page) {
    expect(await page.evaluate(() => (window as any).e2eNoReloadMarker)).toBe(true);
}

test.describe('Pre-auth webapp plugins', () => {
    test.afterAll(async () => {
        await removeTestWebappPlugins();
        await setRestriction(true);
    });

    /**
     * @objective Verify a fresh installation restricts unauthenticated webapp plugin manifests by default
     */
    test('restricts unauthenticated webapp plugins by default on a fresh install', {tag: '@plugins'}, async ({pw}) => {
        // # Initialize setup
        const {adminClient} = await pw.initSetup();

        // * Verify the setting defaults to on
        const config = await adminClient.getConfig();
        expect(config.PluginSettings.RestrictUnauthenticatedWebappPlugins).toBe(true);
    });

    /**
     * @objective Verify unauthenticated requests only receive trimmed manifests of plugins marked webapp.pre_auth
     */
    test('returns only pre-auth plugin manifests to unauthenticated requests', {tag: '@plugins'}, async ({pw}) => {
        // # Install the pre-auth and post-auth test plugins with the restriction on
        await ensureTestWebappPlugins();
        const {adminClient} = await pw.initSetup();
        await setRestriction(true);

        // # Request webapp plugins without a session
        const plugins = await getWebappPluginsAnonymously(pw.loginPage.page);

        // * Verify only the pre-auth plugin is returned
        expect(testPluginIds(plugins)).toEqual([preAuthTestPluginId]);

        // * Verify the manifest is trimmed to what the webapp needs to load the bundle
        const preAuth = plugins.find((p) => p.id === preAuthTestPluginId)!;
        expect(Object.keys(preAuth).sort()).toEqual(['id', 'name', 'version', 'webapp']);
        expect(preAuth.webapp).toEqual({bundle_path: expect.stringContaining(preAuthTestPluginId), pre_auth: true});

        // * Verify authenticated requests still receive every plugin
        const authenticated = (await adminClient.getWebappPlugins()) as unknown as WebappPluginsResponse;
        expect(testPluginIds(authenticated)).toEqual([postAuthTestPluginId, preAuthTestPluginId].sort());
    });

    /**
     * @objective Verify turning the restriction off restores unauthenticated delivery of every webapp plugin
     */
    test(
        'returns all webapp plugins to unauthenticated requests when the restriction is off',
        {tag: '@plugins'},
        async ({pw}) => {
            // # Install the test plugins and turn the restriction off
            await ensureTestWebappPlugins();
            await pw.initSetup();
            await setRestriction(false);

            try {
                // # Request webapp plugins without a session
                const plugins = await getWebappPluginsAnonymously(pw.loginPage.page);

                // * Verify both test plugins are returned
                expect(testPluginIds(plugins)).toEqual([postAuthTestPluginId, preAuthTestPluginId].sort());
            } finally {
                await setRestriction(true);
            }
        },
    );

    /**
     * @objective Verify the login page loads pre-auth plugins and does not load other plugins
     */
    test('loads only pre-auth plugins on the login page', {tag: '@plugins'}, async ({pw}) => {
        // # Install the test plugins with the restriction on
        await ensureTestWebappPlugins();
        await pw.initSetup();
        await setRestriction(true);

        // # Open the login page without a session
        await pw.hasSeenLandingPage();
        const page = pw.loginPage.page;
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // * Verify the pre-auth plugin initialized
        await expect(page.getByTestId(testWebappPluginMarkerTestId(preAuthTestPluginId))).toBeAttached();

        // * Verify the post-auth plugin bundle was not loaded
        await expect(page.locator(`script[id="plugin_${postAuthTestPluginId}"]`)).toHaveCount(0);
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toHaveCount(0);

        // * Verify no page errors were raised
        expect(pageErrors).toEqual([]);
    });

    /**
     * @objective Verify logging in from the login page loads the remaining plugins before redirecting, without a reload
     */
    test('loads post-auth plugins on login so a plugin route deep link renders', {tag: '@plugins'}, async ({pw}) => {
        // # Install the test plugins with the restriction on
        await ensureTestWebappPlugins();
        const {user} = await pw.initSetup();
        await setRestriction(true);

        // # Open the login page with a redirect to the post-auth plugin's custom route
        await pw.hasSeenLandingPage();
        const page = pw.loginPage.page;
        const route = testWebappPluginRoute(postAuthTestPluginId);
        await pw.loginPage.goto(`/login?redirect_to=${encodeURIComponent(route)}`);
        await pw.loginPage.toBeVisible();
        await markWindow(page);

        // # Log in
        await pw.loginPage.submitCredentials(user.username, user.password);

        // * Verify the post-auth plugin's route renders after redirect
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(page.getByTestId(`e2e-route-${postAuthTestPluginId}`)).toHaveText(
            `e2e route ${postAuthTestPluginId}`,
        );

        // * Verify both plugins are loaded and the page did not reload
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toBeAttached();
        await expect(page.getByTestId(testWebappPluginMarkerTestId(preAuthTestPluginId))).toBeAttached();
        await expectWindowNotReloaded(page);
    });

    /**
     * @objective Verify a full page load with an existing session loads every webapp plugin
     */
    test('loads all plugins on a full page load with a session', {tag: '@plugins'}, async ({pw}) => {
        // # Install the test plugins with the restriction on
        await ensureTestWebappPlugins();
        const {user} = await pw.initSetup();
        await setRestriction(true);

        // # Log in by API and open the app
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // * Verify both plugins initialized
        await expect(page.getByTestId(testWebappPluginMarkerTestId(preAuthTestPluginId))).toBeAttached();
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toBeAttached();
    });

    /**
     * @objective Verify that after logout reloads to the login page, logging in as another user loads post-auth plugins again
     */
    test('reloads post-auth plugins when logging in as another user after logout', {tag: '@plugins'}, async ({pw}) => {
        // # Install the test plugins with the restriction on and create a second user
        await ensureTestWebappPlugins();
        const {adminClient, user, team} = await pw.initSetup();
        await setRestriction(true);
        const otherUser = await pw.createNewUserProfile(adminClient, {prefix: 'preauth'});
        await adminClient.addToTeam(team.id, otherUser.id);

        // # Log in through the login page
        await pw.hasSeenLandingPage();
        const page = pw.loginPage.page;
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(user.username, user.password);
        await pw.channelsPage.toBeVisible();
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toBeAttached();

        // # Log out, which reloads the app on the login page without a session
        await pw.channelsPage.logout();
        await pw.loginPage.toBeVisible();

        // * Verify only the pre-auth plugin is loaded on the reloaded login page
        await expect(page.getByTestId(testWebappPluginMarkerTestId(preAuthTestPluginId))).toBeAttached();
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toHaveCount(0);

        // # Log in as the second user
        await markWindow(page);
        await pw.loginPage.submitCredentials(otherUser.username, otherUser.password);
        await pw.channelsPage.toBeVisible();

        // * Verify both plugins are loaded and the page did not reload
        await expect(page.getByTestId(testWebappPluginMarkerTestId(preAuthTestPluginId))).toBeAttached();
        await expect(page.getByTestId(testWebappPluginMarkerTestId(postAuthTestPluginId))).toBeAttached();
        await expectWindowNotReloaded(page);
    });
});
