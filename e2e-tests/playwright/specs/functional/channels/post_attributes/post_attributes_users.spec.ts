// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    OBJECT_TYPE,
    addMember,
    countLoads,
    createField,
    createPostWithValues,
    deleteFields,
    fieldName,
    optionId,
    patchFieldAttrs,
    purgeFields,
    setPostValues,
    skipIfNoPostAttributesLicense,
} from './support';

const CHIPS = 'post-attributes-chips';
const CARD = 'post-attributes-card';
const OPTION_CHIP = 'select-property';
const TEXT_CHIP = 'text-property';

/**
 * @objective Verify a user already on a channel sees another user's new post arrive with its
 * chips, in the centre and in an open thread, with no reload, and that the values travel
 * over their own websocket event rather than on the post's.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('shows a post and a reply from another user with their chips, live', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user: reader, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];
    const collapsedThreads = (await adminClient.getConfig()).ServiceSettings.CollapsedThreads;

    try {
        await purgeFields(adminClient);

        // # Keep replies in the centre, so a reply can be seen in both places
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
            sortOrder: 1,
        });
        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text', sortOrder: 2});
        created.push(classification, note);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {client: author} = await addMember(pw, adminClient, team, [channel.id]);

        // # The reader opens the channel. The frames the page receives are recorded from
        // before the first load, since the socket opens with it.
        const {page, channelsPage} = await pw.testBrowser.login(reader);
        const frames: string[] = [];
        page.on('websocket', (socket) => {
            socket.on('framereceived', (frame) => frames.push(String(frame.payload)));
        });

        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const loads = countLoads(page);

        // # The author posts with values, through the create request, as the composer would
        const root = await createPostWithValues(author, channel.id, `live root ${suffix}`, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
            {field_id: note.id, value: 'from the author'},
        ]);

        // * Verify the post arrived on the reader's page with both chips
        const rootInCenter = await channelsPage.centerView.getPostById(root.id);
        await expect(rootInCenter.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('SECRET');
        await expect(rootInCenter.container.getByTestId(CHIPS).getByTestId(TEXT_CHIP)).toHaveText('from the author');

        // * Verify the values did not ride on the `posted` event, which goes to every member
        // whatever they may read, and that they came in a `property_values_updated` event for
        // this post instead
        const framesFor = (event: string, postId: string) =>
            frames.filter((frame) => (JSON.parse(frame) as {event?: string}).event === event && frame.includes(postId));
        const posted = framesFor('posted', root.id);
        const valuesUpdated = framesFor('property_values_updated', root.id);
        expect(posted).toHaveLength(1);
        expect(posted[0]).not.toContain('property_values');
        expect(valuesUpdated).toHaveLength(1);

        // # The reader opens the thread, and the author replies with a value
        await rootInCenter.reply();
        await channelsPage.sidebarRight.toBeVisible();

        const reply = await createPostWithValues(
            author,
            channel.id,
            `live reply ${suffix}`,
            [{field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')}],
            {rootId: root.id},
        );

        // * Verify the reply carries its chip in the thread sidebar and in the centre
        const replyInRhs = await channelsPage.sidebarRight.getPostById(reply.id);
        await expect(replyInRhs.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('UNCLASSIFIED');

        const replyInCenter = await channelsPage.centerView.getPostById(reply.id);
        await expect(replyInCenter.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('UNCLASSIFIED');

        // * Verify the reply's values came the same way as the root's. Its chip is on
        // screen, so its frames have arrived
        const replyPosted = framesFor('posted', reply.id);
        expect(replyPosted).toHaveLength(1);
        expect(replyPosted[0]).not.toContain('property_values');
        expect(framesFor('property_values_updated', reply.id)).toHaveLength(1);

        // * Verify the root in the thread still has its own, and nothing reloaded
        const rootInRhs = await channelsPage.sidebarRight.getPostById(root.id);
        await expect(rootInRhs.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('SECRET');
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: collapsedThreads}});
    }
});

/**
 * @objective Verify a value added to, changed on, and cleared from another user's post
 * reaches a reader's open page as it happens, with no reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('follows values added to and cleared from a post by another user', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user: reader, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
            sortOrder: 1,
        });
        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text', sortOrder: 2});
        created.push(classification, note);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {client: author} = await addMember(pw, adminClient, team, [channel.id]);

        // # A post with one value, and a reader looking at it
        const post = await createPostWithValues(author, channel.id, `watched ${suffix}`, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(reader);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const chips = postOnScreen.container.getByTestId(CHIPS);

        await expect(chips.getByTestId(OPTION_CHIP)).toHaveText('SECRET');
        await expect(chips.getByTestId(TEXT_CHIP)).toHaveCount(0);

        const loads = countLoads(page);

        // # The author adds a second value
        await setPostValues(author, post.id, [{field_id: note.id, value: 'added later'}]);

        // * Verify it shows up beside the first
        await expect(chips.getByTestId(TEXT_CHIP)).toHaveText('added later');
        await expect(chips.getByTestId(OPTION_CHIP)).toHaveText('SECRET');

        // # The author changes the first
        await setPostValues(author, post.id, [
            {field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')},
        ]);

        // * Verify the chip follows
        await expect(chips.getByTestId(OPTION_CHIP)).toHaveText('UNCLASSIFIED');

        // # The author clears the first, with an empty value, as the modal's trash button does
        await setPostValues(author, post.id, [{field_id: classification.id, value: ''}]);

        // * Verify only the cleared one is gone
        await expect(chips.getByTestId(OPTION_CHIP)).toHaveCount(0);
        await expect(chips.getByTestId(TEXT_CHIP)).toHaveText('added later');
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a field created, renamed or given a renamed option while a reader has
 * the channel open updates what the reader sees without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('follows a field changing while a post by another user is on screen', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user: reader, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
            sortOrder: 1,
        });
        created.push(classification);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {client: author} = await addMember(pw, adminClient, team, [channel.id]);

        const post = await createPostWithValues(author, channel.id, `fields change ${suffix}`, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(reader);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const chips = postOnScreen.container.getByTestId(CHIPS);

        await expect(chips.getByTestId(OPTION_CHIP)).toHaveText('SECRET');

        const loads = countLoads(page);

        // # An option is renamed
        const options = (classification.attrs?.options ?? []) as Array<{id: string; name: string}>;
        await patchFieldAttrs(adminClient, classification, {
            options: options.map((option) => (option.name === 'SECRET' ? {...option, name: 'TOP SECRET'} : option)),
        });

        // * Verify the chip shows the new name
        await expect(chips.getByTestId(OPTION_CHIP)).toHaveText('TOP SECRET');

        // # The field is renamed
        const renamed = `${classification.name}_renamed`;
        await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, classification.id, {name: renamed});

        // * Verify the hover card, the one place a chip's field name is read, shows it
        await chips.hover();
        const card = page.getByTestId(CARD);
        await expect(card.getByText(renamed, {exact: true})).toBeVisible();
        await expect(card.getByText(classification.name, {exact: true})).toHaveCount(0);
        await page.mouse.move(0, 0);
        await expect(card).toBeHidden();

        // # A field is created after the page loaded, and the author sets it on the post
        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text', sortOrder: 2});
        created.push(note);
        await setPostValues(author, post.id, [{field_id: note.id, value: 'new field'}]);

        // * Verify the chip for a field the page had never heard of is drawn
        await expect(chips.getByTestId(TEXT_CHIP)).toHaveText('new field');
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});
