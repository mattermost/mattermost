// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The "About Mattermost" modal — opened from the Channels product switch menu
 * (GlobalHeader.openAbout()) or from System Console's sidebar header menu
 * (SystemConsoleSidebarHeader.openAbout()). Same component either way.
 */
export default class AboutBuildModal {
    readonly container: Locator;

    readonly versionInfo: Locator;
    readonly hashInfo: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.versionInfo = container.getByTestId('aboutModalVersionInfo');
        this.hashInfo = container.locator('.about-modal__hash');
        this.closeButton = container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.versionInfo).toBeVisible();
    }

    /** Reads the "Server Version:" line. */
    async getServerVersion(): Promise<string> {
        const text = await this.versionInfo.innerText();
        const match = text.match(/Server Version:\s*(\S+)/);
        if (!match) {
            throw new Error(`Could not find "Server Version:" in About modal text: ${text}`);
        }
        return match[1];
    }

    /** Reads the "Build Number:" line. */
    async getBuildNumber(): Promise<string> {
        const text = await this.versionInfo.innerText();
        const match = text.match(/Build Number:\s*(\S+)/);
        if (!match) {
            throw new Error(`Could not find "Build Number:" in About modal text: ${text}`);
        }
        return match[1];
    }

    async close() {
        await this.closeButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
