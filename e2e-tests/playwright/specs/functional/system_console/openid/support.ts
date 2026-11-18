// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, testConfig, type App} from '@mattermost/playwright-lib';

/** The masked value the server returns for a saved secret. */
export const FAKE_SETTING = '********************************';

type Provider = 'openid' | 'google' | 'gitlab' | 'office365';

const PROVIDER_LABEL: Record<Provider, string> = {
    openid: 'OpenID Connect (Other)',
    google: 'Google Apps',
    gitlab: 'GitLab',
    office365: 'Entra ID',
};

/** Opens System Console > OpenID Connect and picks a provider. */
export async function chooseProvider(app: App, provider: Provider): Promise<void> {
    await app.page.goto(`${app.adminConsolePage.pathFor()}/authentication/openid`);
    const select = app.admin.setting('openidType').choiceCombobox;
    await expect(select).toBeVisible();
    await select.choose(PROVIDER_LABEL[provider]);
    await expect(select).toHaveValue(provider);
}

/** Saves the page, waiting for Save to settle. */
export async function save(app: App): Promise<void> {
    await expect(app.admin.saveButton).toBeEnabled();
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
    await expect(app.admin.saveButton).toBeSaved();
}

/** Logs out from the System Console menu, landing on the login page. */
export async function logOut(app: App): Promise<void> {
    const menu = app.admin.sidebar.header.menu;
    await menu.container.click();
    await expect(menu.logOutMenuItem).toBeVisible();
    await settle(menu.logOutMenuItem, {wait: Api.Logout}).click();
    await expect(app.login.loginId.container).toBeVisible();
}

/** Checks the login page offers the provider's button, linking to this server's OAuth path (and in its color). */
export async function expectOAuthLogin(
    app: App,
    provider: Provider,
    label: string,
    path: string,
    color?: string,
): Promise<void> {
    const button = app.login.external(provider);
    await expect(button).toBeVisible();
    await expect(button).toHaveText(label);

    // The provider link stays on this server and includes its configured subpath.
    await expect(async () => {
        const href = await button.locator.getAttribute('href');
        expect(href).toBeTruthy();
        const url = new URL(href ?? '', app.page.url());
        expect(url.origin).toBe(new URL(app.page.url()).origin);
        expect(url.pathname).toBe(testConfig.withSubpath(path));
        expect(['', '?extra=expired']).toContain(url.search);
    }).toPass();
    if (color) {
        const rgb = hexToRgb(color);
        await expect(button).toHaveCSS('color', rgb);
        await expect(button).toHaveCSS('border-color', rgb);
    }
}

function hexToRgb(hex: string): string {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
