// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {createField, deleteFields, fieldName, optionId, purgeFields, setPostValues} from './support';

const CHIPS = 'post-attributes-chips';
const OVERFLOW = 'post-attributes-overflow';
const CARD = 'post-attributes-card';

/**
 * @objective Verify hovering the chip row opens a card that reads every attribute the
 * post carries, including the ones the row had no room to draw.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('reads every attribute from the hover card, overflow included', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

    // # Provision four ordered fields and set all four on one post, so two of them
    // land in the row and two only exist behind the badge
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
            sortOrder: 1,
        });
        const caveat = await createField(adminClient, fieldName('caveat', suffix), {
            options: ['NOFORN'],
            sortOrder: 2,
        });
        const owner = await createField(adminClient, fieldName('owner', suffix), {
            type: 'user',
            sortOrder: 3,
        });
        const note = await createField(adminClient, fieldName('note', suffix), {
            type: 'text',
            sortOrder: 4,
        });
        created.push(classification, caveat, owner, note);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'four attributes'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
            {field_id: caveat.id, value: optionId(caveat, 'NOFORN')},
            {field_id: owner.id, value: user.id},
            {field_id: note.id, value: 'Q3 planning'},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const chips = postOnScreen.container.getByTestId(CHIPS);

        // * Verify the row drew the first two and reported the rest as a badge
        await expect(chips.getByText('SECRET', {exact: true})).toBeVisible();
        await expect(chips.getByText('NOFORN', {exact: true})).toBeVisible();
        await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveText('+2');

        // * Verify the badge reads as a count rather than as the glyph "+2". It is
        // `role='img'` with a counted label, so assistive technology is told how many
        // attributes are hidden and never has to interpret the arithmetic.
        await expect(postOnScreen.container.getByRole('img', {name: '2 more attributes'})).toBeVisible();

        // # Hover the row
        await chips.hover();

        // * Verify the card opened
        const card = page.getByTestId(CARD);
        await expect(card).toBeVisible();

        // * Verify the card lists all four attributes, named and valued — the two the
        // row drew and the two only the badge accounted for. This is what the card is
        // for: the row is a summary, and the badge is otherwise unreadable.
        await expect(card.getByRole('listitem')).toHaveCount(4);
        await expect(card.getByRole('listitem').nth(0)).toContainText('SECRET');
        await expect(card.getByRole('listitem').nth(1)).toContainText('NOFORN');
        await expect(card.getByRole('listitem').nth(2)).toContainText(user.username);
        await expect(card.getByRole('listitem').nth(3)).toContainText('Q3 planning');

        // * Verify every row is named after its field, so the values are readable in
        // isolation rather than as a list of bare strings
        for (const field of created) {
            await expect(card.getByText(field.name, {exact: true})).toBeVisible();
        }

        // * Verify the card's one control is reachable by name. `Edit` is the only
        // route from the card into the modal, and a card whose button has no
        // accessible name is a dead end for anything that is not a pointer.
        await expect(card.getByRole('button', {name: 'Edit'})).toBeVisible();
    } finally {
        await deleteFields(adminClient, created);
    }
});
