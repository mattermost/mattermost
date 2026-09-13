// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Browser, Page} from '@playwright/test';
import {test as base} from '@playwright/test';
import type {AxeResults} from 'axe-core';
import {AxeBuilder} from '@axe-core/playwright';

import {TestBrowser} from './browser_context';
import {
    ensureLicense,
    ensurePluginsLoaded,
    ensureServerDeployment,
    shouldHaveCallsEnabled,
    shouldHaveFeatureFlag,
    shouldRunInLinux,
    skipIfFeatureFlagNotSet,
    skipIfNoLicense,
} from './flag';
import {getBlobFromAsset, getFileFromAsset} from './file';
import {
    configureAIBridgeMock,
    createKeycloakUser,
    createLdapUser,
    createMockAIAgent,
    createNewTeam,
    createNewUserProfile,
    createRandomChannel,
    createRandomPost,
    createRandomTeam,
    createRandomUser,
    createUserWithAttributes,
    deleteKeycloakUser,
    deleteLdapUser,
    elasticsearchServerConfig,
    enableAIBridgeTestMode,
    ensureAzurite,
    ensureElasticsearch,
    ensureFeatureFlag,
    ensureKeycloak,
    ensureKeycloakOpenId,
    ensureLocalFile,
    ensureMinio,
    ensureMmctl,
    ensureOpenldap,
    ensureOpensearch,
    ensurePostgresSearch,
    ensureServerEnv,
    ensureSiteUrl,
    generateKeycloakUser,
    generateLdapUser,
    getAdminClient,
    getAIBridgeMock,
    initSetup,
    installAndEnablePlugin,
    isOutsideRemoteUserHour,
    isPluginActive,
    keycloakSamlDescriptorUrl,
    ldapServerConfig,
    listAzuriteBlobNames,
    listMattermostDataFiles,
    listMinioObjectKeys,
    makeClient,
    openidServerConfig,
    opensearchServerConfig,
    recapCompletion,
    resetAIBridgeMock,
    rewriteCompletion,
    runMmctl,
    samlServerConfig,
    saveUpgradePhaseLogs,
    suspendKeycloakUser,
    updateLdapUser,
    upgradeServerImage,
} from './server';
import {
    toBeFocusedWithFocusVisible,
    hideDynamicChannelsContent,
    waitForAnimationEnd,
    waitUntil,
    logFocusedElement,
} from './test_action';
import {pages} from './ui/pages';
import {matchSnapshot} from './visual';
import {
    clearCapturedNotifications,
    clickNotification,
    closeWebsockets,
    connectWebsockets,
    mockWebsockets,
    stubNotification,
    waitForNotification,
} from './mock_browser_api';
import {duration, getRandomId, newTestPassword, simpleEmailRe, wait} from './util';

export {expect} from '@playwright/test';

export type ExtendedFixtures = {
    axe: AxeBuilderExtended;
    pw: PlaywrightExtended;
};

type AxeBuilderOptions = {
    disableColorContrast?: boolean;
    disableLinkInTextBlock?: boolean;
};

export const test = base.extend<ExtendedFixtures>({
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

export class PlaywrightExtended {
    // ./browser_context
    readonly testBrowser;

    // ./flag
    readonly shouldHaveCallsEnabled;
    readonly shouldHaveFeatureFlag;
    readonly shouldRunInLinux;
    readonly ensureLicense;
    readonly ensureServerDeployment;
    readonly skipIfNoLicense;
    readonly skipIfFeatureFlagNotSet;

    // ./file
    readonly getBlobFromAsset;
    readonly getFileFromAsset;

    // ./server
    readonly ensurePluginsLoaded;
    readonly getAdminClient;
    readonly initSetup;
    readonly enableAIBridgeTestMode;
    readonly configureAIBridgeMock;
    readonly getAIBridgeMock;
    readonly resetAIBridgeMock;
    readonly createMockAIAgent;
    readonly rewriteCompletion;
    readonly recapCompletion;
    readonly installAndEnablePlugin;
    readonly isPluginActive;

    // ./server/openldap, ./server/keycloak, ./server/elasticsearch, ./server/opensearch, ./server/minio
    readonly createKeycloakUser;
    readonly createLdapUser;
    readonly deleteKeycloakUser;
    readonly deleteLdapUser;
    readonly elasticsearchServerConfig;
    readonly ensureAzurite;
    readonly ensureElasticsearch;
    readonly ensureFeatureFlag;
    readonly ensureKeycloak;
    readonly ensureKeycloakOpenId;
    readonly ensureLocalFile;
    readonly ensureMinio;
    readonly ensureMmctl;
    readonly ensureOpenldap;
    readonly ensureOpensearch;
    readonly ensurePostgresSearch;
    readonly ensureServerEnv;
    readonly ensureSiteUrl;
    readonly generateKeycloakUser;
    readonly generateLdapUser;
    readonly keycloakSamlDescriptorUrl;
    readonly ldapServerConfig;
    readonly listAzuriteBlobNames;
    readonly listMattermostDataFiles;
    readonly listMinioObjectKeys;
    readonly openidServerConfig;
    readonly opensearchServerConfig;
    readonly runMmctl;
    readonly samlServerConfig;
    readonly suspendKeycloakUser;
    readonly updateLdapUser;

    // ./server/version
    readonly upgradeServerImage;
    // ./server/upgrade_logs
    readonly saveUpgradePhaseLogs;

    // ./test_action
    readonly toBeFocusedWithFocusVisible;
    readonly hideDynamicChannelsContent;
    readonly waitForAnimationEnd;
    readonly waitUntil;
    readonly logFocusedElement;

    // ./mock_browser_api
    readonly stubNotification;
    readonly clearCapturedNotifications;
    readonly waitForNotification;
    readonly clickNotification;
    readonly mockWebsockets;
    readonly connectWebsockets;
    readonly closeWebsockets;

    // ./server
    readonly createNewUserProfile;
    readonly createNewTeam;
    readonly isOutsideRemoteUserHour;
    readonly makeClient;

    // ./visual
    readonly matchSnapshot;

    // ./util
    readonly duration;
    readonly newTestPassword;
    readonly simpleEmailRe;
    readonly wait;

    // random
    readonly random;

    // unauthenticated page
    readonly loginPage;
    readonly keycloakLoginPage;
    readonly landingLoginPage;
    readonly signupPage;
    readonly resetPasswordPage;

    // Same default page as above, post-login - for specs that authenticate it directly (e.g. a
    // real browser SSO flow) rather than via testBrowser.login()'s separate context.
    readonly channelsPage;

    readonly hasSeenLandingPage;

    constructor(browser: Browser, page: Page, isMobile: boolean) {
        // ./browser_context
        this.testBrowser = new TestBrowser(browser);

        // ./flag
        this.shouldHaveCallsEnabled = shouldHaveCallsEnabled;
        this.shouldHaveFeatureFlag = shouldHaveFeatureFlag;
        this.shouldRunInLinux = shouldRunInLinux;
        this.ensureLicense = ensureLicense;
        this.ensureServerDeployment = ensureServerDeployment;
        this.skipIfNoLicense = skipIfNoLicense;
        this.skipIfFeatureFlagNotSet = skipIfFeatureFlagNotSet;

        // ./file
        this.getBlobFromAsset = getBlobFromAsset;
        this.getFileFromAsset = getFileFromAsset;

        // ./server
        this.ensurePluginsLoaded = ensurePluginsLoaded;
        this.initSetup = initSetup;
        this.getAdminClient = getAdminClient;
        this.enableAIBridgeTestMode = enableAIBridgeTestMode;
        this.configureAIBridgeMock = configureAIBridgeMock;
        this.getAIBridgeMock = getAIBridgeMock;
        this.resetAIBridgeMock = resetAIBridgeMock;
        this.createMockAIAgent = createMockAIAgent;
        this.rewriteCompletion = rewriteCompletion;
        this.recapCompletion = recapCompletion;
        this.isOutsideRemoteUserHour = isOutsideRemoteUserHour;
        this.installAndEnablePlugin = installAndEnablePlugin;
        this.isPluginActive = isPluginActive;

        // ./server/openldap, ./server/keycloak, ./server/elasticsearch, ./server/opensearch, ./server/minio
        this.createKeycloakUser = createKeycloakUser;
        this.createLdapUser = createLdapUser;
        this.deleteKeycloakUser = deleteKeycloakUser;
        this.deleteLdapUser = deleteLdapUser;
        this.elasticsearchServerConfig = elasticsearchServerConfig;
        this.ensureAzurite = ensureAzurite;
        this.ensureElasticsearch = ensureElasticsearch;
        this.ensureFeatureFlag = ensureFeatureFlag;
        this.ensureKeycloak = ensureKeycloak;
        this.ensureKeycloakOpenId = ensureKeycloakOpenId;
        this.ensureLocalFile = ensureLocalFile;
        this.ensureMinio = ensureMinio;
        this.ensureMmctl = ensureMmctl;
        this.ensureOpenldap = ensureOpenldap;
        this.ensureOpensearch = ensureOpensearch;
        this.ensurePostgresSearch = ensurePostgresSearch;
        this.ensureServerEnv = ensureServerEnv;
        this.ensureSiteUrl = ensureSiteUrl;
        this.generateKeycloakUser = generateKeycloakUser;
        this.generateLdapUser = generateLdapUser;
        this.keycloakSamlDescriptorUrl = keycloakSamlDescriptorUrl;
        this.ldapServerConfig = ldapServerConfig;
        this.listAzuriteBlobNames = listAzuriteBlobNames;
        this.listMattermostDataFiles = listMattermostDataFiles;
        this.listMinioObjectKeys = listMinioObjectKeys;
        this.openidServerConfig = openidServerConfig;
        this.opensearchServerConfig = opensearchServerConfig;
        this.runMmctl = runMmctl;
        this.samlServerConfig = samlServerConfig;
        this.suspendKeycloakUser = suspendKeycloakUser;
        this.updateLdapUser = updateLdapUser;

        // ./server/version
        this.upgradeServerImage = upgradeServerImage;
        // ./server/upgrade_logs
        this.saveUpgradePhaseLogs = saveUpgradePhaseLogs;

        // ./test_action
        this.toBeFocusedWithFocusVisible = toBeFocusedWithFocusVisible;
        this.hideDynamicChannelsContent = hideDynamicChannelsContent;
        this.waitForAnimationEnd = waitForAnimationEnd;
        this.waitUntil = waitUntil;
        this.logFocusedElement = logFocusedElement;

        // unauthenticated page
        this.loginPage = new pages.LoginPage(page);
        this.keycloakLoginPage = new pages.KeycloakLoginPage(page);
        this.landingLoginPage = new pages.LandingLoginPage(page, isMobile);
        this.signupPage = new pages.SignupPage(page);
        this.resetPasswordPage = new pages.ResetPasswordPage(page);

        // Same default page as above, post-login
        this.channelsPage = new pages.ChannelsPage(page);

        // ./mock_browser_api
        this.stubNotification = stubNotification;
        this.clearCapturedNotifications = clearCapturedNotifications;
        this.waitForNotification = waitForNotification;
        this.clickNotification = clickNotification;
        this.mockWebsockets = mockWebsockets;
        this.connectWebsockets = connectWebsockets;
        this.closeWebsockets = closeWebsockets;

        // ./server
        this.createNewUserProfile = createNewUserProfile;
        this.createNewTeam = createNewTeam;
        this.makeClient = makeClient;

        // ./visual
        this.matchSnapshot = matchSnapshot;

        // ./util
        this.duration = duration;
        this.wait = wait;
        this.newTestPassword = newTestPassword;
        this.simpleEmailRe = simpleEmailRe;

        this.random = {
            id: getRandomId,
            channel: createRandomChannel,
            post: createRandomPost,
            team: createRandomTeam,
            user: createRandomUser,
            userWithAttributes: createUserWithAttributes,
        };

        this.hasSeenLandingPage = async (url = '/') => {
            // Visit the base URL to be able to set the localStorage
            await page.goto(url);
            return waitUntilLocalStorageIsSet(page, '__landingPageSeen__', 'true');
        };
    }
}

export class AxeBuilderExtended {
    readonly builder: (page: Page, options?: AxeBuilderOptions) => AxeBuilder;

    // See https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags
    readonly tags: string[] = ['wcag2a', 'wcag2aa', 'wcag21aa'];

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
