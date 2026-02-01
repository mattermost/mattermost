// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StorageState} from './types';

/**
 * Chrome DevTools Protocol (CDP) interaction functions
 */

export async function injectCookiesViaCDP(port: number, cookies: StorageState['cookies']): Promise<void> {
    const cdpModule = await import('chrome-remote-interface');
    const CDP = cdpModule.default;

    let client;
    try {
        client = await CDP({port});
        const {Network} = client;
        await Network.enable();

        for (const cookie of cookies) {
            await Network.setCookie({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
                expires: cookie.expires,
            });
        }
        console.log(`  Injected ${cookies.length} auth cookies`);
    } finally {
        if (client) await client.close();
    }
}

export async function injectLocalStorageViaCDP(
    port: number,
    baseUrl: string,
    origins: StorageState['origins'],
): Promise<void> {
    if (!origins || origins.length === 0) {
        return;
    }

    const cdpModule = await import('chrome-remote-interface');
    const CDP = cdpModule.default;

    let client;
    try {
        client = await CDP({port});
        const {Page, Runtime} = client;
        await Page.enable();

        // Navigate to the origin to set localStorage
        await Page.navigate({url: baseUrl});
        await Page.loadEventFired();

        let totalItems = 0;
        for (const origin of origins) {
            for (const item of origin.localStorage) {
                await Runtime.evaluate({
                    expression: `localStorage.setItem('${item.name}', '${item.value}')`,
                });
                totalItems++;
            }
        }

        console.log(`  Injected ${totalItems} localStorage items`);

        // Navigate back to about:blank
        await Page.navigate({url: 'about:blank'});
        await Page.loadEventFired();
    } finally {
        if (client) await client.close();
    }
}

export async function preAuthenticateViaCDP(port: number, baseUrl: string): Promise<void> {
    const cdpModule = await import('chrome-remote-interface');
    const CDP = cdpModule.default;

    let client;
    try {
        client = await CDP({port});
        const {Page, Runtime} = client;
        await Page.enable();

        // Navigate to base URL to properly establish the authenticated session
        // This ensures cookies are validated and the user session is active
        console.log(`  Pre-authenticating by visiting ${baseUrl}...`);

        await Page.navigate({url: baseUrl});
        await Page.loadEventFired();

        // Wait for client-side routing to settle
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check current URL and wait for any redirects to complete
        let currentUrl = '';
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            const result = await Runtime.evaluate({expression: 'window.location.href'});
            currentUrl = result.result.value as string;

            // If we're on login or landing, the auth didn't work
            if (currentUrl.includes('/login')) {
                console.warn(`  [WARN] Pre-auth failed - redirected to login: ${currentUrl}`);
                break;
            }

            // Landing page is shown briefly, wait for it to redirect
            if (currentUrl.includes('/landing')) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`  Waiting for landing page redirect... (attempt ${attempts}/${maxAttempts})`);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
                console.warn(`  [WARN] Stuck on landing page: ${currentUrl}`);
                break;
            }

            // Successfully authenticated - we're on a channel or other authenticated page
            console.log(`  Pre-authenticated, current URL: ${currentUrl}`);
            break;
        }

        // Navigate to about:blank to clear the page state before Lighthouse runs
        await Page.navigate({url: 'about:blank'});
        await Page.loadEventFired();
    } finally {
        if (client) await client.close();
    }
}
