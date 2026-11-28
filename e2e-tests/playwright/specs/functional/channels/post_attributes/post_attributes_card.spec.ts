// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    createField,
    deleteFields,
    fieldName,
    optionChip,
    optionId,
    purgeFields,
    setPostValues,
    skipIfNoPostAttributesLicense,
} from './support';

const SECRET = 'SECRET';
const NOFORN = 'NOFORN';
const NOTE = 'Third quarter planning';

/**
 * @objective Verify hovering the chip row opens a card that reads every attribute the
 * post carries, including the ones the row had no room to draw.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('reads every attribute from the hover card, overflow included', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision four ordered fields and set all four on one post, so two of them
    // land in the row and two only exist behind the badge
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET],
            sortOrder: 1,
        });
        const caveat = await createField(adminClient, fieldName('caveat', suffix), {
            options: [NOFORN],
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'four attributes'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, SECRET)},
            {field_id: caveat.id, value: optionId(caveat, NOFORN)},
            {field_id: owner.id, value: user.id},
            {field_id: note.id, value: NOTE},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const chips = app.center.postList.post(post).attributes;

        // * Verify the row drew the first two and reported the rest as a badge
        await expect(optionChip(chips, SECRET)).toBeVisible();
        await expect(optionChip(chips, NOFORN)).toBeVisible();
        await expect(chips.overflowImg.locator).toHaveText('+2');

        // * Verify the badge reads as a count rather than as the glyph "+2". It is
        // `role='img'` with a counted label, so assistive technology is told how many
        // attributes are hidden and never has to interpret the arithmetic.
        await expect(chips.overflowImg.locator).toBeVisible();
        await expect(chips.overflowImg.locator).toHaveAttribute('role', 'img');
        await expect(chips.overflowImg.locator).toHaveAccessibleName('2 more attributes');

        // # Hover the row
        await chips.locator.hover();

        // * Verify the card opened
        const card = app.postAttributesCard;
        await expect(card.locator).toBeVisible();

        // * Verify the card lists all four attributes, named and valued — the two the
        // row drew and the two only the badge accounted for. This is what the card is
        // for: the row is a summary, and the badge is otherwise unreadable.
        await expect(card.attributeList).toHaveKeyCount(4);
        const rows = await card.attributeList.keys();
        await expect(card.attribute(rows[0]).container).toContainText(SECRET);
        await expect(card.attribute(rows[1]).container).toContainText(NOFORN);
        await expect(card.attribute(rows[2]).container).toContainText(user.username);
        await expect(card.attribute(rows[3]).container).toContainText(NOTE);

        // * Verify every row is named after its field, so the values are readable in
        // isolation rather than as a list of bare strings
        for (const field of created) {
            await expect(card.attribute(field).nameText.locator).toHaveText(field.name);
        }

        // * Verify the card's one control is reachable by name. `Edit` is the only
        // route from the card into the modal, and a card whose button has no
        // accessible name is a dead end for anything that is not a pointer.
        await expect(card.editButton.locator).toBeVisible();
        await expect(card.editButton.locator).toHaveAccessibleName('Edit');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the hover card closes when the pointer leaves it, and that its `Edit`
 * button opens the attributes modal and takes the card away.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('closes when the pointer leaves, and Edit opens the modal', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a select field and set it on a post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        created.push(classification);

        const post = await userClient.createTestPost({channel_id: channel.id, message: 'card to modal'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const chips = app.center.postList.post(post).attributes;
        const card = app.postAttributesCard;

        // # Hover the row, then move the pointer well away from it and from the card
        await chips.locator.hover();
        await expect(card.locator).toBeVisible();
        await app.page.mouse.move(5, 5);

        // * Verify the card closed
        await expect(card.locator).toBeHidden();

        // # Open it again and press Edit
        await chips.locator.hover();
        await expect(card.locator).toBeVisible();
        const modal = await card.editButton.clickTo(app.postAttributesModal);

        // * Verify the modal opened on this post's attribute and the card is gone
        await expect(modal.attribute(classification).locator).toBeVisible();
        await expect(card.locator).toBeHidden();
    } finally {
        await deleteFields(adminClient, created);
    }
});
