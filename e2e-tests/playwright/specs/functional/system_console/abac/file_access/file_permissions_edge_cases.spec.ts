// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {
    expect,
    getRandomId,
    keyOfElement,
    openChannel,
    test,
    testConfig,
    type App,
    Api,
    settle,
} from '@mattermost/playwright-lib';

import {concealedPost, reveal} from '../../../channels/burn_on_read/support';
import {deletePermissionPolicyByName, ensureUserAttributes} from '../support';
import {createPermissionPolicy, setAbacEnabled} from '../surface';

import {
    ensureABACEnabled,
    expectFilesRedacted,
    postNamed,
    postWithFile,
    setupUserAndChannel,
    waitForPolicy,
} from './helpers';

// Each surface renders attachments through a different React tree, so one that forgets to
// honour RedactedFileCount is invisible to server-side coverage.
//
// Denies via a comparison no test user satisfies: policy creation rejects a bare `false`
// literal, and these users have no Department value.
const DENY_ALL_CEL = "user.attributes.Department == 'no-such-value-deny-all'";

const THREAD_ROOT_MESSAGE = 'thread root with file';

/** Turns attribute-based access on and denies downloads to everyone; returns the policy's name. */
async function denyDownloads(app: App, adminClient: Client4, prefix: string) {
    await setAbacEnabled(app, true);
    await ensureUserAttributes(adminClient);
    const name = `${prefix} Download Deny ${getRandomId()}`;
    await createPermissionPolicy(app, {
        name,
        cel: DENY_ALL_CEL,
        permissions: ['download_file_attachment'],
    });
    await waitForPolicy(adminClient, name);
    await ensureABACEnabled(adminClient);
    return name;
}

test.describe('ABAC file permissions - redaction across surfaces', () => {
    let lastPolicyName = '';
    let savedAdminClient: Client4 | null = null;

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
            const {testUser: deniedUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);

            // # Admin sends a Burn-on-Read message carrying a file
            const admin = await openChannel(pw, adminUser, {team, channel: {name: channelName}});
            await admin.center.postCreate.burnOnReadButton.click();
            await expect(admin.center.postCreate.burnOnReadLabel).toBeVisible();
            await postWithFile(admin, adminClient, channelId, 'BOR with file');

            // # Enable ABAC and deny download for everyone
            lastPolicyName = await denyDownloads(admin, adminClient, 'BOR');

            // # The denied user opens the channel and reveals the concealed message
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});
            const {post} = await concealedPost(app);
            await reveal(post);

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
            const admin = await openChannel(pw, adminUser, {team, channel: {name: channelName}});
            const original = await postWithFile(admin, adminClient, channelId, 'original with file');
            const originalPostId = original.postId;

            // Use testConfig.internalBaseURL rather than the admin client's host-mapped route:
            // the server must recognize this URL as its own SiteURL to embed it through an
            // internal permalink lookup, instead of fetching it back over HTTP as a link
            // (which fails under testcontainers).
            const permalinkUrl = `${testConfig.siteURL}/${team.name}/pl/${originalPostId}`;
            await admin.center.postCreate.message.container.fill(permalinkUrl);
            await settle(admin.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

            // Permalink embeds resolve asynchronously. Wait until the admin view has the
            // preview so later assertions are not racing the first metadata fetch.
            const adminPermalink = await postNamed(admin, adminClient, channelId, permalinkUrl);
            expect(await keyOfElement(adminPermalink.locator)).not.toBe(originalPostId);
            await expect(adminPermalink.permalinkPreview).toBeVisible({timeout: pw.duration.half_min});

            // # Enable ABAC and deny download for everyone
            lastPolicyName = await denyDownloads(admin, adminClient, 'Permalink');

            // # The denied user opens the channel
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});

            // * Verify the standalone original post is redacted
            await expectFilesRedacted(await postNamed(app, adminClient, channelId, 'original with file'));

            // * Verify the embedded preview is redacted too, and not merely file-less
            const permalinkPost = await postNamed(app, adminClient, channelId, permalinkUrl);
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
            const {testUser: deniedUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);

            // # Admin posts a file
            const admin = await openChannel(pw, adminUser, {team, channel: {name: channelName}});
            await postWithFile(admin, adminClient, channelId, THREAD_ROOT_MESSAGE);

            // # Enable ABAC and deny download for everyone
            lastPolicyName = await denyDownloads(admin, adminClient, 'Thread');

            // # The denied user opens the post in a thread
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});
            const centerPost = await postNamed(app, adminClient, channelId, THREAD_ROOT_MESSAGE);
            await expectFilesRedacted(centerPost);
            await centerPost.container.hover();
            await centerPost.menu.replyButton.click();

            // * Verify the thread's copy of the post is redacted as well
            const rootId = centerPost.postId;
            const rhsPost = app.rhs.thread.post({id: rootId});
            await expect(rhsPost).toBeVisible();
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
        const {testUser: deniedUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);

        // # Admin posts a file with a searchable, unique term
        const searchTerm = `redactme${getRandomId()}`;
        const admin = await openChannel(pw, adminUser, {team, channel: {name: channelName}});
        const posted = await postWithFile(admin, adminClient, channelId, searchTerm);
        const postId = posted.postId;

        // # Enable ABAC and deny download for everyone
        lastPolicyName = await denyDownloads(admin, adminClient, 'Search');

        // # The denied user searches for the post
        const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});
        await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
        await app.searchBox.inputSearchbox.fill(searchTerm);
        await app.searchBox.inputSearchbox.press('Enter');

        // * Verify the search result shows the redacted placeholder, not the file
        const result = app.search.results.post({id: postId});
        await expect(result).toBeVisible();
        await expectFilesRedacted(result);
    });
});
