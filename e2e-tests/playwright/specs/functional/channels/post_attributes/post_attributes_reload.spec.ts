// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {HYDRATION_PARAM, createField, deleteFields, fieldName, optionId, purgeFields, setPostValues} from './support';

const CHIPS = 'post-attributes-chips';

/**
 * @objective Verify a value changed after a channel was loaded is on screen after a
 * reload, rather than being hidden behind a cached response.
 *
 * Every other spec in this suite asserts within one page session, where the WebSocket
 * broadcast updates the chip and no posts request is made at all. A reload is the one
 * path that goes back to the posts endpoint, and it is the path that broke: post ETags
 * are built from Posts.UpdateAt, which a value write never touches, so a conditional
 * request could be answered 304 and the browser would keep values that had already
 * changed.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('shows a value changed since the last load after a reload', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

    // # Provision a select field and set it on a post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
        });
        created.push(classification);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'reloaded post'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the first load shows the original value, so the reload below is
        // comparing against something that was really on screen
        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(postOnScreen.container.getByTestId(CHIPS)).toBeVisible();
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();

        // # Change the value from outside this browser, so nothing in the page has been
        // told about it other than through a refetch
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')},
        ]);

        // # Reload, and capture the hydrated posts response the reload makes
        const hydrated = page.waitForResponse((response) => response.url().includes(HYDRATION_PARAM));
        await page.reload();
        await channelsPage.toBeVisible();

        // * Verify the new value is on screen and the old one is gone. This is the
        // symptom, asserted before the mechanism so a regression reports as the thing a
        // user would see rather than as a header that changed
        const postAfterReload = await channelsPage.centerView.getPostById(post.id);
        await expect(postAfterReload.container.getByText('UNCLASSIFIED', {exact: true})).toBeVisible();
        await expect(postAfterReload.container.getByText('SECRET', {exact: true})).not.toBeVisible();

        // * Verify the response carries no ETag. This is the mechanism: an ETag here is
        // one a later request would revalidate against, and it cannot see value changes
        const response = await hydrated;
        expect(await response.headerValue('etag')).toBeNull();
    } finally {
        await deleteFields(adminClient, created);
    }
});
