// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, expectFilesRedacted, getRandomId, testConfig} from '@mattermost/playwright-lib';

import {createPermissionPolicy, deletePermissionPolicyByName, navigateToPermissionPoliciesPage} from '../support';

import {ensureABACEnabled, setupUserAndChannel, waitForPolicy} from './helpers';

// Each surface renders attachments through a different React tree, so one that forgets to
// honour RedactedFileCount is invisible to server-side coverage.
//
// Denies via a comparison no test user satisfies: policy creation rejects a bare `false`
// literal, and these users have no Department value.
const DENY_ALL_CEL = "user.attributes.Department == 'no-such-value-deny-all'";
const THREAD_ROOT_MESSAGE = 'thread root with file';

test.describe('ABAC file permissions - redaction across surfaces', () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
    });

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    /**
     * @objective Verify a Burn-on-Read message's attachment is redacted after the recipient
     * reveals it, so the reveal cannot be used to sidestep the download policy.
     */
    test(
        'MM-T5827 redacts the attachment of a revealed Burn-on-Read message',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.four_min);

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

            // # Admin sends a Burn-on-Read message carrying a file
            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.toggleBurnOnRead();
            await adminChannelsPage.centerView.postCreate.postMessage('BOR with file', ['sample_text_file.txt']);

            // # Enable ABAC and deny download for everyone
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await navigateToPermissionPoliciesPage(systemConsolePage.page);

            lastPolicyName = `BOR Download Deny ${getRandomId()}`;
            await createPermissionPolicy(systemConsolePage.page, {
                name: lastPolicyName,
                celExpression: DENY_ALL_CEL,
                permissions: ['Download Files'],
                adminClient,
            });
            await waitForPolicy(adminClient, lastPolicyName);
            await ensureABACEnabled(adminClient);

            // # The denied user opens the channel and reveals the concealed message
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            const post = await channelsPage.centerView.getLastPost();
            await post.concealedPlaceholder.toBeVisible();
            await post.concealedPlaceholder.clickToReveal();
            await post.concealedPlaceholder.waitForReveal(pw.duration.ten_sec);

            // * Verify the revealed message's file is redacted
            await post.toHaveFilesRedacted();
        },
    );

    /**
     * @objective Verify the file inside an embedded permalink preview is redacted, not just the
     * file on the original post — the preview is built from a separately fetched post.
     */
    test(
        'MM-T5828 redacts the attachment inside an embedded permalink preview',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.four_min);

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser: deniedUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);

            // # Admin posts a file, then posts a permalink to it in the same channel
            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage('original with file', ['sample_text_file.txt']);

            const originalPosts = await adminClient.getPosts(channelId, 0, 1);
            const originalPostId = originalPosts.order[0];

            // Use testConfig.internalBaseURL rather than the admin client's host-mapped route:
            // the server must recognize this URL as its own SiteURL to embed it through an
            // internal permalink lookup, instead of fetching it back over HTTP as a link
            // (which fails under testcontainers).
            const permalinkUrl = `${testConfig.internalBaseURL}/${team.name}/pl/${originalPostId}`;
            await adminChannelsPage.centerView.postCreate.postMessage(permalinkUrl);

            // Both posts are addressed by ID: the embed repeats the original's text, so filtering
            // by text cannot tell the two of them apart.
            const permalinkPosts = await adminClient.getPosts(channelId, 0, 1);
            const permalinkPostId = permalinkPosts.order[0];

            // # Enable ABAC and deny download for everyone
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await navigateToPermissionPoliciesPage(systemConsolePage.page);

            lastPolicyName = `Permalink Download Deny ${getRandomId()}`;
            await createPermissionPolicy(systemConsolePage.page, {
                name: lastPolicyName,
                celExpression: DENY_ALL_CEL,
                permissions: ['Download Files'],
                adminClient,
            });
            await waitForPolicy(adminClient, lastPolicyName);
            await ensureABACEnabled(adminClient);

            // # The denied user opens the channel
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the standalone original post is redacted
            const originalPost = await channelsPage.centerView.getPostById(originalPostId);
            await originalPost.toHaveFilesRedacted();

            // * Verify the embedded preview is redacted too, and not merely file-less
            const permalinkPost = await channelsPage.centerView.getPostById(permalinkPostId);
            await expect(permalinkPost.postPreview).toBeVisible();
            await permalinkPost.toHaveFilesRedacted(permalinkPost.postPreview);
        },
    );

    /**
     * @objective Verify a denied user sees the redacted placeholder when the same post is opened
     * in a thread in the right-hand sidebar, which renders through its own post list.
     */
    test(
        'redacts the attachment when the post is opened in a thread',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.four_min);

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

            // # Admin posts a file
            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage(THREAD_ROOT_MESSAGE, ['sample_text_file.txt']);

            // # Enable ABAC and deny download for everyone
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await navigateToPermissionPoliciesPage(systemConsolePage.page);

            lastPolicyName = `Thread Download Deny ${getRandomId()}`;
            await createPermissionPolicy(systemConsolePage.page, {
                name: lastPolicyName,
                celExpression: DENY_ALL_CEL,
                permissions: ['Download Files'],
                adminClient,
            });
            await waitForPolicy(adminClient, lastPolicyName);
            await ensureABACEnabled(adminClient);

            // # The denied user opens the post in a thread
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            const centerPost = await channelsPage.centerView.getPostByText(THREAD_ROOT_MESSAGE);
            await centerPost.toHaveFilesRedacted();
            await centerPost.openAThread();
            await channelsPage.sidebarRight.toBeVisible();

            // * Verify the thread's copy of the post is redacted as well
            const rhsPost = await channelsPage.sidebarRight.getFirstPost();
            await rhsPost.toHaveFilesRedacted();
        },
    );

    /**
     * @objective Verify a denied user sees the redacted placeholder in search results, which
     * render posts through the search panel rather than a channel post list.
     */
    test('redacts the attachment in search results', {tag: '@abac_file_permissions'}, async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        // # Admin posts a file with a searchable, unique term
        const searchTerm = `redactme${getRandomId()}`;
        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage(searchTerm, ['sample_text_file.txt']);

        // # Enable ABAC and deny download for everyone
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        lastPolicyName = `Search Download Deny ${getRandomId()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
            celExpression: DENY_ALL_CEL,
            permissions: ['Download Files'],
            adminClient,
        });
        await waitForPolicy(adminClient, lastPolicyName);
        await ensureABACEnabled(adminClient);

        // # The denied user searches for the post
        const {channelsPage} = await pw.testBrowser.login(deniedUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();
        await channelsPage.searchFor(searchTerm);

        // * Verify the search result shows the redacted placeholder, not the file
        const result = channelsPage.searchResultsPanel.getResultByText(searchTerm).first();
        await expect(result).toBeVisible();
        await expectFilesRedacted(result);
    });
});
