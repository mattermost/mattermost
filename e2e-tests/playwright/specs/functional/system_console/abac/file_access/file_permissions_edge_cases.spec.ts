// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    assetPath,
    settle,
    type App,
    expect,
    test,
    enableABAC,
    getRandomId,
    testConfig,
} from '@mattermost/playwright-lib';

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
            const {app: adminApp} = await pw.testBrowser.login(adminUser);
            await adminApp.channelsPage.goto({team, channel: {name: channelName}});
            await expect(adminApp.center.postCreate.message.container).toBeVisible();
            await adminApp.center.postCreate.burnOnReadButton.click();
            await expect(adminApp.center.postCreate.burnOnReadLabel).toBeVisible();
            const sent = await postWithFile(adminApp, 'BOR with file');

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
            const {app} = await pw.testBrowser.login(deniedUser);
            await app.channelsPage.goto({team, channel: {name: channelName}});
            await expect(app.center.postCreate.message.container).toBeVisible();

            const post = app.center.postList.post({id: sent.id});
            await expect(post.revealButton).toBeVisible();
            await expect(post.revealButton).toBeEnabled();
            await post.revealButton.click();
            await expect(post.revealButton).not.toBeVisible({timeout: pw.duration.ten_sec});

            // * Verify the revealed message's file is redacted
            await expectFilesRedacted(post);
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
            const {app: adminApp} = await pw.testBrowser.login(adminUser);
            await adminApp.channelsPage.goto({team, channel: {name: channelName}});
            await expect(adminApp.center.postCreate.message.container).toBeVisible();
            await postWithFile(adminApp, 'original with file');

            const originalPosts = await adminClient.getPosts(channelId, 0, 1);
            const originalPostId = originalPosts.order[0];

            // Use testConfig.internalBaseURL rather than the admin client's host-mapped route:
            // the server must recognize this URL as its own SiteURL to embed it through an
            // internal permalink lookup, instead of fetching it back over HTTP as a link
            // (which fails under testcontainers).
            const permalinkUrl = `${testConfig.siteURL}/${team.name}/pl/${originalPostId}`;
            await adminApp.center.postCreate.message.container.fill(permalinkUrl);
            await expect(adminApp.center.postCreate.message.container).toHaveValue(permalinkUrl);
            const permalinkSent = await settle(adminApp.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
            await expect(adminApp.center.postList.post({id: permalinkSent.id})).toContainText(permalinkUrl);

            // Permalink embeds resolve asynchronously. Wait until the admin view has the
            // preview so later assertions are not racing the first metadata fetch.
            const permalinkPostAdmin = adminApp.center.postList.post({id: permalinkSent.id});
            await expect(permalinkPostAdmin.permalinkPreview).toBeVisible({timeout: pw.duration.half_min});

            // Both posts are addressed by ID: the embed repeats the original's text, so filtering
            // by text cannot tell the two of them apart.
            const permalinkPosts = await adminClient.getPosts(channelId, 0, 1);
            const permalinkPostId = permalinkPosts.order[0];
            expect(permalinkPostId).not.toBe(originalPostId);

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
            const {app} = await pw.testBrowser.login(deniedUser);
            await app.channelsPage.goto({team, channel: {name: channelName}});
            await expect(app.center.postCreate.message.container).toBeVisible();

            // * Verify the standalone original post is redacted
            const originalPost = app.center.postList.post({id: originalPostId});
            await expectFilesRedacted(originalPost);

            // * Verify the embedded preview is redacted too, and not merely file-less
            const permalinkPost = app.center.postList.post({id: permalinkPostId});
            await expect(permalinkPost.permalinkPreview).toBeVisible({timeout: pw.duration.half_min});
            await expectFilesRedacted(permalinkPost.permalinkPreview);
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
            const {app: adminApp} = await pw.testBrowser.login(adminUser);
            await adminApp.channelsPage.goto({team, channel: {name: channelName}});
            await expect(adminApp.center.postCreate.message.container).toBeVisible();
            await postWithFile(adminApp, THREAD_ROOT_MESSAGE);

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
            const {app} = await pw.testBrowser.login(deniedUser);
            await app.channelsPage.goto({team, channel: {name: channelName}});
            await expect(app.center.postCreate.message.container).toBeVisible();

            const {post: centerPost, id: centerPostId} = await postNamed(app, THREAD_ROOT_MESSAGE);
            await expectFilesRedacted(centerPost);
            await centerPost.container.hover();
            await expect(centerPost.menu.replyButton).toBeVisible();
            await centerPost.menu.replyButton.click();
            await expect(app.rhs.thread.scroller).toBeVisible();

            // * Verify the thread's copy of the post is redacted as well
            const rhsPost = app.rhs.thread.post({id: centerPostId});
            await expectFilesRedacted(rhsPost);
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
        const {app: adminApp} = await pw.testBrowser.login(adminUser);
        await adminApp.channelsPage.goto({team, channel: {name: channelName}});
        await expect(adminApp.center.postCreate.message.container).toBeVisible();
        await postWithFile(adminApp, searchTerm);

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
        const {app} = await pw.testBrowser.login(deniedUser);
        await app.channelsPage.goto({team, channel: {name: channelName}});
        await expect(app.center.postCreate.message.container).toBeVisible();
        await app.globalHeader.search.openButton.click();
        await expect(app.searchBox.inputSearchbox).toBeVisible();
        await app.searchBox.inputSearchbox.fill(searchTerm);
        await expect(app.searchBox.inputSearchbox).toHaveValue(searchTerm);
        await app.searchBox.inputSearchbox.press('Enter');
        await expect(app.search.results).toBeVisible();

        // * Verify the search result shows the redacted placeholder, not the file
        let resultId = '';
        await expect
            .poll(async () => {
                for (const id of await app.search.results.postList.keys()) {
                    if ((await app.search.results.post({id}).message.container.text()).includes(searchTerm)) {
                        resultId = id;
                        return true;
                    }
                }
                return false;
            })
            .toBe(true);
        const result = app.search.results.post({id: resultId});
        await expect(result).toBeVisible();
        await expectFilesRedacted(result);
    });
});

// Uploads a file and waits for its keyed post to render.
async function postWithFile(app: App, message: string) {
    await expect(app.center.postCreate.attachButton).toBeVisible();
    await settle(app.center.postCreate.uploadInput, {wait: Api.UploadFile}).chooseFiles(
        `${assetPath}/sample_text_file.txt`,
    );
    await expect(app.center.postCreate.filePreviews.fileList).toHaveKeyCount(1);
    const [fileId] = await app.center.postCreate.filePreviews.fileList.keys();
    await expect(app.center.postCreate.filePreviews.file({id: fileId}).details).toBeVisible();
    await expect(app.center.postCreate.filePreviews).toContainText('sample_text_file.txt');
    await app.center.postCreate.message.container.fill(message);
    await expect(app.center.postCreate.message.container).toHaveValue(message);
    await expect(app.center.postCreate.sendButton).toBeVisible();
    await expect(app.center.postCreate.sendButton).toBeEnabled();
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect(app.center.postList.post({id: sent.id})).toContainText(message);
    return sent;
}

async function postNamed(app: App, message: string) {
    let id = '';
    await expect
        .poll(async () => {
            for (const key of await app.center.postList.postList.keys()) {
                const post = app.center.postList.post({id: key});
                if ((await post.message.container.text()).includes(message)) {
                    id = key;
                    return true;
                }
            }
            return false;
        })
        .toBe(true);
    const post = app.center.postList.post({id});
    await expect(post).toContainText(message);
    return {post, id};
}

type CenterPost = ReturnType<App['center']['postList']['post']>;

// A post, or the permalink preview embedded in one: both have a redacted placeholder and an attachment list.
type WithFiles = Pick<CenterPost, 'redactedFiles'> & {
    attachments: CenterPost['attachments'] | CenterPost['permalinkPreview']['attachments'];
};

async function expectFilesRedacted(post: WithFiles) {
    await expect(post.redactedFiles).toBeVisible();
    await expect(post.attachments).toHaveCount(0);
}
