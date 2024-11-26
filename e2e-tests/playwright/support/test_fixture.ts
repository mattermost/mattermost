import {test as base, Browser, Page} from '@playwright/test';
import {AxeResults} from 'axe-core';
import AxeBuilder from '@axe-core/playwright';

import {TestBrowser} from './browser_context';
import {shouldHaveCallsEnabled, shouldHaveFeatureFlag, shouldRunInLinux, ensureLicense, skipIfNoLicense} from './flag';
import {initSetup, getAdminClient} from './server';
import {hideDynamicChannelsContent, waitForAnimationEnd, waitUntil} from './test_action';
import {pages} from './ui/pages';
import {matchSnapshot} from './visual';
import {stubNotification, waitForNotification} from './mock_browser_api';

export {expect} from '@playwright/test';

type ExtendedFixtures = {
    axe: AxeBuilderExtended;
    pw: PlaywrightExtended;
    pages: typeof pages;
};

type AxeBuilderOptions = {
    disableColorContrast?: boolean;
    disableLinkInTextBlock?: boolean;
};

export const test = base.extend<ExtendedFixtures>({
    // eslint-disable-next-line no-empty-pattern
    axe: async ({}, use) => {
        const ab = new AxeBuilderExtended();
        await use(ab);
    },
    pw: async ({browser}, use) => {
        const pw = new PlaywrightExtended(browser);
        await use(pw);
        await pw.testBrowser.close();
    },
    // eslint-disable-next-line no-empty-pattern
    pages: async ({}, use) => {
        await use(pages);
    },
});

class PlaywrightExtended {
    // ./browser_context
    readonly testBrowser;

    // ./flag
    readonly shouldHaveCallsEnabled;
    readonly shouldHaveFeatureFlag;
    readonly shouldRunInLinux;
    readonly ensureLicense;
    readonly skipIfNoLicense;

    // ./server
    readonly getAdminClient;
    readonly initSetup;

    // ./test_action
    readonly hideDynamicChannelsContent;
    readonly waitForAnimationEnd;
    readonly waitUntil;

    // ./ui/pages
    readonly pages;

    // ./visual
    readonly matchSnapshot;

    // ./mock_browser_api
    readonly stubNotification;
    readonly waitForNotification;

    constructor(browser: Browser) {
        // ./browser_context
        this.testBrowser = new TestBrowser(browser);

        // ./flag
        this.shouldHaveCallsEnabled = shouldHaveCallsEnabled;
        this.shouldHaveFeatureFlag = shouldHaveFeatureFlag;
        this.shouldRunInLinux = shouldRunInLinux;
        this.ensureLicense = ensureLicense;
        this.skipIfNoLicense = skipIfNoLicense;

        // ./server
        this.initSetup = initSetup;
        this.getAdminClient = getAdminClient;

        // ./test_action
        this.hideDynamicChannelsContent = hideDynamicChannelsContent;
        this.waitForAnimationEnd = waitForAnimationEnd;
        this.waitUntil = waitUntil;

        // ./ui/pages
        this.pages = pages;

        // ./visual
        this.matchSnapshot = matchSnapshot;

        // ./mock_browser_api
        this.stubNotification = stubNotification;
        this.waitForNotification = waitForNotification;
    }
}

class AxeBuilderExtended {
    readonly builder: (page: Page, options?: AxeBuilderOptions) => AxeBuilder;

    // See https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags
    readonly tags: string[] = ['wcag2a', 'wcag2aa'];

    constructor() {
        this.builder = (page: Page, options: AxeBuilderOptions = {}) => {
            // See https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md#wcag-20-level-a--aa-rules
            const disabledRules: string[] = [];

            if (options.disableColorContrast) {
                // Disabled in pages due to impact to overall theme of Mattermost.
                // Option: make use of custom theme to improve color contrast.
                disabledRules.push('color-contrast');
            }

            if (options.disableLinkInTextBlock) {
                // Disabled in pages due to impact to overall theme of Mattermost.
                // Option: make use of custom theme to improve color contrast.
                disabledRules.push('link-in-text-block');
            }

            return new AxeBuilder({page}).withTags(this.tags).disableRules(disabledRules);
        };
    }

    violationFingerprints(accessibilityScanResults: AxeResults) {
        const fingerprints = accessibilityScanResults.violations.map((violation) => ({
            rule: violation.id,
            description: violation.description,
            helpUrl: violation.helpUrl,
            targets: violation.nodes.map((node) => {
                return {target: node.target, impact: node.impact, html: node.html};
            }),
        }));

        return JSON.stringify(fingerprints, null, 2);
    }
}
