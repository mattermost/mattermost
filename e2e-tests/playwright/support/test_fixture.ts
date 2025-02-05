import {test as base, Browser, Page} from '@playwright/test';
import {AxeResults} from 'axe-core';
import AxeBuilder from '@axe-core/playwright';

import {TestBrowser} from './browser_context';
import {
    shouldHaveCallsEnabled,
    shouldHaveFeatureFlag,
    shouldRunInLinux,
    ensureLicense,
    skipIfNoLicense,
    skipIfFeatureFlagNotSet,
} from './flag';
import {initSetup, getAdminClient} from './server';
import {hideDynamicChannelsContent, waitForAnimationEnd, waitUntil} from './test_action';
import pages from './ui/pages';
import {matchSnapshot} from './visual';
import {stubNotification, waitForNotification} from './mock_browser_api';
import {duration} from './util';

export {expect} from '@playwright/test';

type ExtendedFixtures = {
    axe: AxeBuilderExtended;
    pw: PlaywrightExtended;
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
    pw: async ({browser, page, isMobile}, use) => {
        const pw = new PlaywrightExtended(browser, page, isMobile);
        await use(pw);
        await pw.testBrowser.close();
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
    readonly skipIfFeatureFlagNotSet;

    // ./server
    readonly getAdminClient;
    readonly initSetup;

    // ./test_action
    readonly hideDynamicChannelsContent;
    readonly waitForAnimationEnd;
    readonly waitUntil;

    // unauthenticated page
    readonly loginPage;
    readonly landingLoginPage;
    readonly signupPage;
    readonly resetPasswordPage;

    // ./visual
    readonly matchSnapshot;

    // ./mock_browser_api
    readonly stubNotification;
    readonly waitForNotification;

    readonly hasSeenLandingPage;

    constructor(browser: Browser, page: Page, isMobile: boolean) {
        // ./browser_context
        this.testBrowser = new TestBrowser(browser);

        // ./flag
        this.shouldHaveCallsEnabled = shouldHaveCallsEnabled;
        this.shouldHaveFeatureFlag = shouldHaveFeatureFlag;
        this.shouldRunInLinux = shouldRunInLinux;
        this.ensureLicense = ensureLicense;
        this.skipIfNoLicense = skipIfNoLicense;
        this.skipIfFeatureFlagNotSet = skipIfFeatureFlagNotSet;

        // ./server
        this.initSetup = initSetup;
        this.getAdminClient = getAdminClient;

        // ./test_action
        this.hideDynamicChannelsContent = hideDynamicChannelsContent;
        this.waitForAnimationEnd = waitForAnimationEnd;
        this.waitUntil = waitUntil;

        // unauthenticated page
        this.loginPage = new pages.LoginPage(page);
        this.landingLoginPage = new pages.LandingLoginPage(page, isMobile);
        this.signupPage = new pages.SignupPage(page);
        this.resetPasswordPage = new pages.ResetPasswordPage(page);

        // ./visual
        this.matchSnapshot = matchSnapshot;

        // ./mock_browser_api
        this.stubNotification = stubNotification;
        this.waitForNotification = waitForNotification;

        this.hasSeenLandingPage = async () => {
            // Visit the base URL to be able to set the localStorage
            await page.goto('/');
            return await waitUntilLocalStorageIsSet(page, '__landingPageSeen__', 'true');
        };
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

async function waitUntilLocalStorageIsSet(page: Page, key: string, value: string, timeout = duration.ten_sec) {
    await waitUntil(
        () =>
            page.evaluate(
                ({key, value}) => {
                    if (localStorage.getItem(key) === value) {
                        return true;
                    }
                    localStorage.setItem(key, value);
                    return false;
                },
                {key, value},
            ),
        {timeout},
    );
}
