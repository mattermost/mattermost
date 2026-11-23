// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import type {ChannelsPage, ChannelsPost} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    OBJECT_TYPE,
    addFieldOptions,
    countLoads,
    createField,
    deleteFields,
    fieldName,
    optionId,
    patchFieldAttrs,
    purgeFields,
    setPostValues,
    skipIfNoPostAttributesLicense,
} from './support';

const CHIPS = 'post-attributes-chips';
const OVERFLOW = 'post-attributes-overflow';
const CARD = 'post-attributes-card';
const OPTION_CHIP = 'select-property';
const MODAL = '#postAttributesModal';

/**
 * Opens the post's `…` menu with the pointer and picks `Attributes`. The message text is
 * hovered, so the pointer never rests on the chip row and the hover card stays closed.
 */
async function openModalFromPostMenu(channelsPage: ChannelsPage, post: ChannelsPost) {
    await post.messageText.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.container.getByRole('menuitem', {name: 'Attributes'}).click();
}

// A field's options with one left out. A field with no options at all reads as one that
// keeps its choices elsewhere and shows the stored text, so a deletion that leaves the
// field empty is not a deletion as far as the chip can tell.
function withoutOption(field: PropertyField, name: string) {
    return (field.attrs?.options as Array<{id: string; name: string}>).filter((option) => option.name !== name);
}

/**
 * @objective Verify chips follow the fields' sort order, then their name, on every post in
 * the channel, and that reordering a field reorders the chips in place.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'orders chips by sort order then name on every post, and follows a reorder',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision four select fields. Two share a sort order, so only their names can
        // tell them apart, and the names are in the opposite order to creation.
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const zeta = await createField(adminClient, fieldName('zeta', suffix), {options: ['Z1'], sortOrder: 2});
            const beta = await createField(adminClient, fieldName('beta', suffix), {options: ['B1'], sortOrder: 1});
            const alpha = await createField(adminClient, fieldName('alpha', suffix), {options: ['A1'], sortOrder: 1});
            const gamma = await createField(adminClient, fieldName('gamma', suffix), {options: ['G1'], sortOrder: 3});
            created.push(zeta, beta, alpha, gamma);

            // # Set every field on two posts, so the order is checked on more than one
            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const posts = [];

            for (const message of ['first ordered post', 'second ordered post']) {
                const post = await userClient.createTestPost({channel_id: channel.id, message});

                await setPostValues(adminClient, post.id, [
                    {field_id: zeta.id, value: optionId(zeta, 'Z1')},
                    {field_id: beta.id, value: optionId(beta, 'B1')},
                    {field_id: alpha.id, value: optionId(alpha, 'A1')},
                    {field_id: gamma.id, value: optionId(gamma, 'G1')},
                ]);
                posts.push(post);
            }

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify both posts draw alpha then beta (same sort order, so by name) and put
            // the other two behind the badge
            for (const post of posts) {
                const onScreen = await channelsPage.centerView.getPostById(post.id);

                await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['A1', 'B1']);

                await expect(onScreen.container.getByTestId(OVERFLOW)).toHaveText('+2');
            }

            // # Move the field that came third to the front, from another session
            const loads = countLoads(page);
            await patchFieldAttrs(adminClient, zeta, {sort_order: 0});

            // * Verify the chips on both posts reordered without a reload
            for (const post of posts) {
                const onScreen = await channelsPage.centerView.getPostById(post.id);

                await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['Z1', 'A1']);

                await expect(onScreen.container.getByTestId(OVERFLOW)).toHaveText('+2');
            }
            expect(loads()).toBe(0);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify a multiselect that fills the row is cut short, and the badge counts
 * its remaining entries and every field after it: the row reads in field order.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'cuts a multiselect that fills the row short and counts the rest in the badge',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision a multiselect that holds three entries, then a single select after it
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const caveats = await createField(adminClient, fieldName('caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON', 'RELIDO'],
                sortOrder: 1,
            });
            const level = await createField(adminClient, fieldName('level', suffix), {
                options: ['SECRET'],
                sortOrder: 2,
            });
            created.push(caveats, level);

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createTestPost({channel_id: channel.id, message: 'one field takes the row'});
            await setPostValues(adminClient, post.id, [
                {
                    field_id: caveats.id,
                    value: [optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON'), optionId(caveats, 'RELIDO')],
                },
                {field_id: level.id, value: optionId(level, 'SECRET')},
            ]);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const onScreen = await channelsPage.centerView.getPostById(post.id);

            // * Verify the multiselect spent the whole budget on its first two entries, and the
            // single select behind it did not take a slot even though one entry would not fit
            await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['NOFORN', 'ORCON']);
            await expect(onScreen.container.getByText('SECRET', {exact: true})).toHaveCount(0);

            // * Verify the badge counts the entry that did not fit and the field after it
            await expect(onScreen.container.getByTestId(OVERFLOW)).toHaveText('+2');
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify what each visibility level shows: an `always` field with no value and
 * a `hidden` field with a value draw no chip and no hover card row, while the modal lists
 * both, and a `when_set` field draws a chip once it is set.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'keeps always and hidden fields off the chips and the card but in the modal',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision one field per visibility level
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const always = await createField(adminClient, fieldName('always', suffix), {
                options: ['ALWAYS1'],
                visibility: 'always',
                sortOrder: 1,
            });
            const hidden = await createField(adminClient, fieldName('hidden', suffix), {
                options: ['HIDDEN1'],
                visibility: 'hidden',
                sortOrder: 2,
            });
            const whenSet = await createField(adminClient, fieldName('whenset', suffix), {
                options: ['SET1', 'SET2'],
                visibility: 'when_set',
                sortOrder: 3,
            });
            created.push(always, hidden, whenSet);

            // # Two posts: one with nothing set, and one with the hidden field set and the
            // `when_set` one still empty
            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const empty = await userClient.createTestPost({channel_id: channel.id, message: 'nothing set'});
            const post = await userClient.createTestPost({channel_id: channel.id, message: 'hidden set'});
            await setPostValues(adminClient, post.id, [{field_id: hidden.id, value: optionId(hidden, 'HIDDEN1')}]);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify neither post draws a chip row: an `always` field with no value and a
            // `hidden` one with a value both stay off the message list
            const emptyOnScreen = await channelsPage.centerView.getPostById(empty.id);
            const postOnScreen = await channelsPage.centerView.getPostById(post.id);

            await expect(emptyOnScreen.container).toContainText('nothing set');
            await expect(emptyOnScreen.container.getByTestId(CHIPS)).toHaveCount(0);
            await expect(postOnScreen.container).toContainText('hidden set');
            await expect(postOnScreen.container.getByTestId(CHIPS)).toHaveCount(0);

            // * Verify the modal still lists all three fields on the post with the hidden
            // value: it says where an attribute is advertised, not whether it may be read
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await expect(page.locator(MODAL)).toBeVisible();
            await expect(page.getByTestId(`post-attribute-row-${always.name}`)).toBeVisible();
            await expect(page.getByTestId(`post-attribute-row-${hidden.name}`)).toBeVisible();
            await expect(page.getByTestId(`post-attribute-trigger-${hidden.name}`)).toHaveText('HIDDEN1');

            // * Verify the empty `always` row has no value, and the `when_set` field with none
            // has no row at all
            await expect(page.getByTestId(`post-attribute-row-${whenSet.name}`)).toHaveCount(0);
            await page.keyboard.press('Escape');
            await expect(page.locator(MODAL)).toBeHidden();

            // # Set the `when_set` field
            await setPostValues(adminClient, post.id, [{field_id: whenSet.id, value: optionId(whenSet, 'SET2')}]);

            // * Verify only that field drew a chip, and the card lists it alone: the hidden
            // and unset `always` fields have no row there either
            const chips = postOnScreen.container.getByTestId(CHIPS);
            await expect(chips.getByTestId(OPTION_CHIP)).toHaveText(['SET2']);
            await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveCount(0);

            await chips.hover();

            const card = page.getByTestId(CARD);
            await expect(card).toBeVisible();
            await expect(card.getByRole('listitem')).toHaveCount(1);
            await expect(card.getByRole('listitem')).toContainText('SET2');
            await expect(card).not.toContainText(always.name);
            await expect(card).not.toContainText(hidden.name);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify the text subtypes that store an id draw what it names: a channel with
 * its icon and name, a team, and a linked post as the channel it is in. A channel the user
 * cannot see draws the deleted label. The timestamp subtype is not covered: the
 * access_control group stores a text value as a string, and the timestamp chip reads a number.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('resolves channel, team and linked post values', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one text field per subtype
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const channelField = await createField(adminClient, fieldName('channel', suffix), {
            type: 'text',
            subType: 'channel',
        });
        const teamField = await createField(adminClient, fieldName('team', suffix), {type: 'text', subType: 'team'});
        const postField = await createField(adminClient, fieldName('post', suffix), {type: 'text', subType: 'post'});
        created.push(channelField, teamField, postField);

        // # A channel the user is in, one they cannot see, and the post the link points at
        const visible = await adminClient.createPublicChannel(team.id, `visible-${suffix}`);
        await adminClient.addToChannel(user.id, visible.id);
        const hidden = await adminClient.createPrivateChannel(team.id, `hidden-${suffix}`);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const target = await userClient.createTestPost({channel_id: townSquare.id, message: 'the linked post'});

        // # One post per subtype, so each draws a single chip
        const withChannel = await userClient.createTestPost({channel_id: townSquare.id, message: 'channel value'});
        const withHidden = await userClient.createTestPost({channel_id: townSquare.id, message: 'unseen channel'});
        const withTeam = await userClient.createTestPost({channel_id: townSquare.id, message: 'team value'});
        const withPost = await userClient.createTestPost({channel_id: townSquare.id, message: 'post value'});

        await setPostValues(adminClient, withChannel.id, [{field_id: channelField.id, value: visible.id}]);
        await setPostValues(adminClient, withHidden.id, [{field_id: channelField.id, value: hidden.id}]);
        await setPostValues(adminClient, withTeam.id, [{field_id: teamField.id, value: team.id}]);
        await setPostValues(adminClient, withPost.id, [{field_id: postField.id, value: target.id}]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, townSquare.name);
        await channelsPage.toBeVisible();

        // * Verify a channel shows its icon and display name, not its id
        const channelChip = (await channelsPage.centerView.getPostById(withChannel.id)).container.getByTestId(
            'channel-property',
        );
        await expect(channelChip).toContainText(visible.display_name);
        await expect(channelChip).not.toContainText(visible.id);
        await expect(channelChip.locator('svg, i').first()).toBeVisible();

        // * Verify a channel the user cannot see draws the deleted label, not a blank
        const hiddenChip = (await channelsPage.centerView.getPostById(withHidden.id)).container.getByTestId(
            'channel-property',
        );
        await expect(hiddenChip).toContainText('Deleted channel');

        // * Verify a team shows its display name
        const teamChip = (await channelsPage.centerView.getPostById(withTeam.id)).container.getByTestId(
            'team-property',
        );
        await expect(teamChip).toContainText(team.display_name);
        await expect(teamChip).not.toContainText(team.id);

        // * Verify a linked post names the channel it is in
        const postChip = (await channelsPage.centerView.getPostById(withPost.id)).container.getByTestId(
            'post-preview-property',
        );
        await expect(postChip).toHaveText(`Message in ~${townSquare.display_name}`);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a long text value is capped by width in the chip while its full text
 * stays in the chip's title.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('caps a long text chip by width and keeps the full text in its title', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a text field and set a value far wider than a chip may be
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        // The access_control group caps a text value at 64 characters
        const long = 'A long note that keeps going well past what fits in one chip.';
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'long text'});
        await setPostValues(adminClient, post.id, [{field_id: note.id, value: long}]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const chip = (await channelsPage.centerView.getPostById(post.id)).container.getByTestId('text-property');

        // * Verify the full text is in the title, and the chip is no wider than its cap
        await expect(chip).toHaveAttribute('title', long);

        const box = await chip.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeLessThanOrEqual(160);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a value whose option was deleted from its field stops drawing, and
 * the badge stops counting it, without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('drops a chip and its badge count when an option is deleted', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision three select fields and set all three, so one lands in the badge
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const first = await createField(adminClient, fieldName('first', suffix), {options: ['X1', 'X2'], sortOrder: 1});
        const second = await createField(adminClient, fieldName('second', suffix), {
            options: ['Y1', 'Y2'],
            sortOrder: 2,
        });
        const third = await createField(adminClient, fieldName('third', suffix), {options: ['Z1', 'Z2'], sortOrder: 3});
        created.push(first, second, third);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'options go away'});
        await setPostValues(adminClient, post.id, [
            {field_id: first.id, value: optionId(first, 'X1')},
            {field_id: second.id, value: optionId(second, 'Y1')},
            {field_id: third.id, value: optionId(third, 'Z1')},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const onScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['X1', 'Y1']);
        await expect(onScreen.container.getByTestId(OVERFLOW)).toHaveText('+1');

        // # Delete the option behind the badge
        const loads = countLoads(page);
        await patchFieldAttrs(adminClient, third, {options: withoutOption(third, 'Z1')});

        // * Verify the badge is gone and the chips are as they were
        await expect(onScreen.container.getByTestId(OVERFLOW)).toHaveCount(0);
        await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['X1', 'Y1']);

        // # Delete the option of a chip that is drawn
        await patchFieldAttrs(adminClient, second, {options: withoutOption(second, 'Y1')});

        // * Verify that chip went, without a reload
        await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(['X1']);
        expect(loads()).toBe(0);

        // # Delete the option of the last drawn field. The group refuses an empty option
        // list, so the field keeps its other option and the post's value is the orphan.
        await patchFieldAttrs(adminClient, first, {options: withoutOption(first, 'X1')});

        // * Verify the post draws no chip, rather than the stored option id as raw text
        await expect(onScreen.container.getByTestId(CHIPS)).toHaveCount(0);
        await expect(onScreen.container.getByText(optionId(first, 'X1'))).toHaveCount(0);

        // # Reload, so the field comes from the server rather than the websocket update
        await page.reload();
        await channelsPage.toBeVisible();

        // * Verify the same
        const reloaded = await channelsPage.centerView.getPostById(post.id);
        await expect(reloaded.container).toContainText('options go away');
        await expect(reloaded.container.getByTestId(CHIPS)).toHaveCount(0);
        await expect(reloaded.container.getByText(optionId(first, 'X1'))).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a value on a field with more options than the server sends is still
 * drawn: the field arrives without its option list, so the stored option is shown as it
 * is rather than hidden as if it had been deleted.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('draws a value on a field whose options are too many to send', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // # A select field with one option to set, then enough more that the server leaves
        // the list out of every read: it sends at most 1000
        const many = await createField(adminClient, fieldName('many', suffix), {options: ['Chosen']});
        created.push(many);
        const chosen = optionId(many, 'Chosen');
        await addFieldOptions(
            adminClient,
            many,
            Array.from({length: 1000}, (_, index) => `Option ${index}`),
        );

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: `many options ${suffix}`});
        await setPostValues(adminClient, post.id, [{field_id: many.id, value: chosen}]);

        // # Open the channel, so the field is read with its options left out
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the post draws the stored option as a chip
        const onScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(onScreen.container.getByTestId(CHIPS)).toBeVisible();
        await expect(onScreen.container.getByTestId(OPTION_CHIP)).toHaveText(chosen);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify deleting a field removes its chips from every post that showed them,
 * in the centre and in the thread sidebar, without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test("drops a deleted field's chips everywhere", {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision two fields and set both on a thread root and on another post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const doomed = await createField(adminClient, fieldName('doomed', suffix), {options: ['GONE1'], sortOrder: 1});
        const kept = await createField(adminClient, fieldName('kept', suffix), {options: ['KEPT1'], sortOrder: 2});
        created.push(doomed, kept);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const root = await userClient.createTestPost({channel_id: channel.id, message: 'thread root'});
        const other = await userClient.createTestPost({channel_id: channel.id, message: 'another post'});

        for (const post of [root, other]) {
            await setPostValues(adminClient, post.id, [
                {field_id: doomed.id, value: optionId(doomed, 'GONE1')},
                {field_id: kept.id, value: optionId(kept, 'KEPT1')},
            ]);
        }

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const rootInCenter = await channelsPage.centerView.getPostById(root.id);
        const otherInCenter = await channelsPage.centerView.getPostById(other.id);

        await rootInCenter.reply();
        await channelsPage.sidebarRight.toBeVisible();
        const rootInRhs = await channelsPage.sidebarRight.getPostById(root.id);

        for (const view of [rootInCenter, otherInCenter, rootInRhs]) {
            await expect(view.container.getByText('GONE1', {exact: true})).toBeVisible();
        }

        // # Delete the field from another session
        const loads = countLoads(page);
        await adminClient.deletePropertyField(GROUP, OBJECT_TYPE, doomed.id);

        // * Verify its chip is gone from all three places and the other field's remains
        for (const view of [rootInCenter, otherInCenter, rootInRhs]) {
            await expect(view.container.getByText('GONE1', {exact: true})).toHaveCount(0);

            await expect(view.container.getByText('KEPT1', {exact: true})).toBeVisible();
        }
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a deleted post draws no chips, though the values it had are still
 * stored.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('draws no chips on a deleted post', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, set it on a thread root that has a reply (so the deleted root
    // stays on screen as a placeholder), then delete the root
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        created.push(classification);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const root = await userClient.createTestPost({channel_id: channel.id, message: 'about to be deleted'});
        await userClient.createTestPost({channel_id: channel.id, root_id: root.id, message: 'reply that stays'});
        await setPostValues(adminClient, root.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const onScreen = await channelsPage.centerView.getPostById(root.id);
        await expect(onScreen.container.getByText('SECRET', {exact: true})).toBeVisible();

        // # Delete the root from another session
        await userClient.deletePost(root.id);

        // * Verify the post is on screen as deleted, and its chip went with its message
        await onScreen.toBeDeleted('about to be deleted');
        await expect(onScreen.container.getByTestId(CHIPS)).toHaveCount(0);
        await expect(onScreen.container.getByText('SECRET', {exact: true})).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a burn-on-read post draws no chips before it is revealed or after,
 * even with a value stored on it.
 *
 * @precondition The PostAttributes and BurnOnRead features are enabled.
 */
test('draws no chips on a burn-on-read post, concealed or revealed', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // Before ensureLicense, which fails rather than skips when the server has no licence
    await skipIfNoPostAttributesLicense();
    await pw.ensureLicense();

    // # Provision a field, and send a burn-on-read post to a second user in a DM. The
    // create path refuses values on a burn-on-read post, so one is written afterwards.
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];
    const config = await adminClient.getConfig();

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {...config.ServiceSettings, EnableBurnOnRead: true}});

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        created.push(classification);

        const [receiver] = await adminClient.createUsers(team.id, 1);
        const dm = await adminClient.createDirectChannel([user.id, receiver.id]);
        const post = await userClient.createPost({
            channel_id: dm.id,
            message: `burn after reading ${suffix}`,
            type: 'burn_on_read',
        });

        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(receiver);
        await channelsPage.goto(team.name, `@${user.username}`);
        await channelsPage.toBeVisible();

        // * Verify the concealed post draws no chips
        const borPost = await channelsPage.centerView.getConcealedBorPost();
        await expect(borPost.concealedPlaceholder.container).toBeVisible();
        await expect(borPost.container.getByTestId(CHIPS)).toHaveCount(0);

        // # Reveal it
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        // * Verify the revealed post shows its message and still draws no chips
        await expect(borPost.container).toContainText(`burn after reading ${suffix}`);
        await expect(borPost.container.getByTestId(CHIPS)).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: config.ServiceSettings.EnableBurnOnRead}});
    }
});

/**
 * @objective Verify a system message draws no chips, even though the server takes a value
 * on one: a system message is not something a user wrote.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('draws no chips on a system message', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, then make a system message by changing a channel's header
    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        created.push(classification);

        const channel = await adminClient.createPublicChannel(team.id, `system-${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.patchChannel(channel.id, {header: `header ${suffix}`});

        const posts = await adminClient.getPosts(channel.id);
        const system = Object.values(posts.posts).find((post) => post.type === 'system_header_change');
        expect(system).toBeDefined();

        // # Give it a value
        await setPostValues(adminClient, system!.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the system message is on screen and carries no chips
        const onScreen = await channelsPage.centerView.getPostById(system!.id);
        await onScreen.toBeSystemMessage();
        await expect(onScreen.container.getByTestId(CHIPS)).toHaveCount(0);
        await expect(onScreen.container.getByText('SECRET', {exact: true})).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});
