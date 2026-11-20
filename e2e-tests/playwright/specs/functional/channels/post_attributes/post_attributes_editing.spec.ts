// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, settle, test, duration} from '@mattermost/playwright-lib';

import {
    VALUES_ROUTE,
    countLoads,
    createField,
    deleteFields,
    fieldName,
    openModalFromPostMenu,
    optionChip,
    optionId,
    purgeFields,
    recordRequests,
    setPostValues,
} from './support';

// Option names and text values the specs create
const SECRET = 'SECRET';
const UNCLASSIFIED = 'UNCLASSIFIED';
const NOFORN = 'NOFORN';
const ORCON = 'ORCON';
const THIRD_QUARTER = 'Third quarter planning';
const FOURTH_QUARTER = 'Fourth quarter planning';

// The padlock's accessible name. It is what tells a screen reader why the row can't be
// changed, so the padlock is checked for it rather than only for being there.
const LOCKED_REASON = "You don't have permission to modify this attribute.";

// Everything a keyboard can land on, for checking the chip row holds none of it
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * @objective Verify the whole non-pointer route works: the post's `…` menu opens by
 * keyboard, `Attributes` opens the modal, a value is changed with the keyboard alone,
 * and the chip on the post follows. Also verify tabbing across the post never lands on
 * the chip row.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('changes a value by keyboard alone, and never tabs into the chip row', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    /*
     * # Provision one text field and set it on a post
     *
     * A text attribute rather than an option-bearing one, because the option menu
     * cannot be driven from a keyboard while it is open over this modal: the menu is
     * portalled to `document.body`, so the modal's focus enforcement and the menu's own
     * focus trap pull the focus back and forth between them indefinitely and no menu
     * item ever holds it. The text control is rendered inline in the modal and has no
     * such problem, so it is the value type that can prove the route end to end today.
     */
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'keyboard route'});
        await setPostValues(adminClient, post.id, [{field_id: note.id, value: THIRD_QUARTER}]);

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chips = postOnScreen.attributes;

        await expect(chips.value.textText.locator).toHaveText(THIRD_QUARTER);

        // * Verify the chip row holds nothing a keyboard can reach. The row is a
        // read-only summary by design, so it carries no tab stop of its own and none of
        // the chips is a control.
        expect(
            await chips.locator.evaluate((row, focusable) => row.querySelectorAll(focusable).length, FOCUSABLE),
        ).toBe(0);
        await expect(chips.locator).not.toHaveAttribute('tabindex', /.*/);

        /*
         * # Tab forward from the first control on the post, far enough to cross all of it
         *
         * The message text is hovered to bring the post's action row out — its buttons
         * are `display: none` until the post is hovered or the message-list keyboard
         * navigation marks it active, and neither the pointer nor the hover card ever
         * goes near the chip row here.
         */
        await postOnScreen.message.container.hover();
        await expect(postOnScreen.menu.dotMenuButton.locator).toBeVisible();
        await postOnScreen.menu.dotMenuButton.focus();

        // * Verify no tab stop is inside the chip row. Asserted on each step rather than
        // only at the end, so a row that takes focus and hands it straight back is still
        // caught.
        for (let step = 0; step < 12; step++) {
            await page.keyboard.press('Tab');

            await expect
                .poll(() => chips.locator.evaluate((row) => row.contains(document.activeElement)), {
                    message: `tab stop ${step + 1} landed inside the chip row`,
                })
                .toBe(false);
        }

        // # Open the post's menu from the keyboard, the pointer having only uncovered
        // the button
        await postOnScreen.message.container.hover();
        await expect(postOnScreen.menu.dotMenuButton.locator).toBeVisible();
        await postOnScreen.menu.dotMenuButton.press('Enter');
        const dotMenu = app.postDotMenu;
        await expect(dotMenu.locator).toBeVisible();

        // # Walk down to `Attributes` with the arrow keys. Its position in the menu
        // depends on what else the post allows, so it is walked to rather than counted to.
        const attributesItem = dotMenu.postAttributesMenuItem.locator;

        await expect(async () => {
            await page.keyboard.press('ArrowDown');
            await expect(attributesItem).toBeFocused({timeout: duration.half_sec});
        }).toPass({timeout: duration.half_min});

        // # Open the modal
        await page.keyboard.press('Enter');

        const modal = app.postAttributesModal.locator;
        await expect(modal).toBeVisible();

        // # Tab to the attribute's own control
        const input = app.postAttributesModal.attribute(note).valueInputTextbox.locator;

        await expect(async () => {
            await page.keyboard.press('Tab');
            await expect(input).toBeFocused({timeout: duration.half_sec});
        }).toPass({timeout: duration.half_min});

        // * Verify the control announces which attribute it writes, rather than leaving
        // a screen reader with an unnamed text box in a modal of several
        await expect(input).toHaveAccessibleName(note.name);

        // # Replace the value and commit it. Enter blurs rather than writing directly,
        // so blur stays the only commit path.
        const noteInput = app.postAttributesModal.attribute(note).valueInputTextbox;
        await noteInput.fill(FOURTH_QUARTER);
        await expect(input).toHaveValue(FOURTH_QUARTER);
        await settle(noteInput, {wait: Api.UpdatePropertyValues}).press('Enter');

        // # Close the modal from the keyboard
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();

        // * Verify the chip on the post carries the new value. Nothing here touched the
        // chip row, and nothing but the keyboard changed anything, so this is the whole
        // route a keyboard user has.
        await expect(chips.value.textText.locator).toHaveText(FOURTH_QUARTER);
        await expect(chips.locator).not.toContainText(THIRD_QUARTER);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify picking an option in the modal rewrites the chip on the post behind
 * it, with no reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('rewrites the chip behind the modal when an option is picked', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one select field and set it on a post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET, UNCLASSIFIED],
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'about to be rewritten'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, SECRET)},
        ]);

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chips = postOnScreen.attributes;

        await expect(optionChip(chips, SECRET)).toBeVisible();

        const loads = countLoads(page);

        // # Open the modal and pick the other option
        await openModalFromPostMenu(app, postOnScreen);
        await expect(app.postAttributesModal.locator).toBeVisible();

        await app.postAttributesModal
            .attribute(classification)
            .valueButton.clickTo(app.postAttributesModal.attribute(classification).valueMenu);

        // # Pick the option and wait on the write itself rather than on elapsed time
        await settle(
            app.postAttributesModal
                .attribute(classification)
                .valueMenu.option({id: optionId(classification, UNCLASSIFIED)}),
            {wait: Api.UpdatePropertyValues},
        ).click();

        // * Verify the chip behind the modal changed. The row reads the store, so the
        // write's broadcast is what moves it — nothing re-delivers the post.
        await expect(optionChip(chips, UNCLASSIFIED)).toBeVisible();
        await expect(chips.locator).not.toContainText(SECRET);

        // * Verify the modal stayed open over the post it is editing
        await expect(app.postAttributesModal.locator).toBeVisible();

        // * Verify nothing reloaded the page to get there
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the trash button clears a value: the chip leaves the post, the row
 * keeps its place with nothing to clear, and the card stops listing it.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('clears a value with the trash button, dropping chip and card row', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision two set fields. The one being cleared is declared `always`, so its
    // row survives losing its value and the trash button's disappearance is separable
    // from the row's.
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET],
            visibility: 'always',
            sortOrder: 1,
        });
        const caveat = await createField(adminClient, fieldName('caveat', suffix), {
            options: [NOFORN],
            sortOrder: 2,
        });
        created.push(classification, caveat);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'about to be cleared'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, SECRET)},
            {field_id: caveat.id, value: optionId(caveat, NOFORN)},
        ]);

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chips = postOnScreen.attributes;

        await expect(optionChip(chips, SECRET)).toBeVisible();
        await expect(optionChip(chips, NOFORN)).toBeVisible();

        // # Open the modal and clear the first attribute
        await openModalFromPostMenu(app, postOnScreen);
        await expect(app.postAttributesModal.locator).toBeVisible();

        // * Verify the trash button is named after its own attribute, so a modal of
        // several rows does not offer several buttons called "Clear"
        const clear = app.postAttributesModal.attribute(classification).clearButton.locator;
        await expect(clear).toHaveAccessibleName(`Clear ${classification.name}`);

        await settle(app.postAttributesModal.attribute(classification).clearButton, {
            wait: Api.UpdatePropertyValues,
        }).click();

        // * Verify the chip left the post and the other one stayed
        await expect(chips.locator).not.toContainText(SECRET);
        await expect(optionChip(chips, NOFORN)).toBeVisible();

        // * Verify the row kept its place — it is declared `always` — and lost the
        // trash button, there being nothing left to clear
        await expect(app.postAttributesModal.attribute(classification).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveText('');
        await expect(clear).toHaveCount(0);

        // # Close the modal and hover what is left of the row
        await page.keyboard.press('Escape');
        await expect(app.postAttributesModal.locator).toBeHidden();

        await chips.locator.hover();

        const card = app.postAttributesCard;
        await expect(card.locator).toBeVisible();

        // * Verify the card lost the row with the value, rather than keeping a named
        // row with nothing in it
        await expect(card.attributeList).toHaveKeyCount(1);
        await expect(card.locator).toContainText(NOFORN);
        await expect(card.attribute(classification).locator).toHaveCount(0);
        await expect(card.locator).not.toContainText(classification.name);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a field the current user may not write renders as read-only: a
 * padlock, no way to open a value, and no trash button.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('locks a field the user may not write, with a padlock and no way in', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision three fields across the permission levels that matter here: one the
    // member may write, one only a system admin may, and one nobody may
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const open = await createField(adminClient, fieldName('open', suffix), {
            options: [SECRET],
            sortOrder: 1,
        });
        const restricted = await createField(adminClient, fieldName('restricted', suffix), {
            options: [NOFORN],
            permissionValues: 'sysadmin',
            sortOrder: 2,
        });
        const sealed = await createField(adminClient, fieldName('sealed', suffix), {
            options: [ORCON],
            permissionValues: 'none',
            visibility: 'always',
            sortOrder: 3,
        });
        created.push(open, restricted, sealed);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'mixed permissions'});

        // The sealed field gets no value: `none` is refused for every session that
        // reaches the server over HTTP, the administering one included. Declaring it
        // `always` is what puts its row in the modal regardless.
        await setPostValues(adminClient, post.id, [
            {field_id: open.id, value: optionId(open, SECRET)},
            {field_id: restricted.id, value: optionId(restricted, NOFORN)},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);

        await openModalFromPostMenu(app, postOnScreen);
        await expect(app.postAttributesModal.locator).toBeVisible();

        // * Verify the writable field offers both controls, so the absences below are
        // about permission rather than about the modal not having drawn
        await expect(app.postAttributesModal.attribute(open).valueButton.locator).toHaveText(SECRET);
        await expect(app.postAttributesModal.attribute(open).clearButton.locator).toHaveCount(1);
        await expect(app.postAttributesModal.attribute(open).lockedImg.locator).toHaveCount(0);

        // * Verify the restricted field shows its value as text, marked with a padlock
        // that carries the reason as its accessible name
        const restrictedRow = app.postAttributesModal.attribute(restricted);

        await expect(restrictedRow.locator).toContainText(NOFORN);
        await expect(restrictedRow.lockedImg.locator).toBeVisible();
        await expect(restrictedRow.lockedImg.locator).toHaveAccessibleName(LOCKED_REASON);

        // * Verify there is no way in. The trash button is *absent* rather than
        // disabled, which is the deliberate shape: a disabled control on half the rows
        // is one the user has to learn to ignore.
        await expect(app.postAttributesModal.attribute(restricted).valueButton.locator).toHaveCount(0);
        await expect(app.postAttributesModal.attribute(restricted).clearButton.locator).toHaveCount(0);

        // * Verify a field nobody may write reads the same way with nothing stored
        const sealedRow = app.postAttributesModal.attribute(sealed);

        await expect(sealedRow.locator).toBeVisible();
        await expect(sealedRow.lockedImg.locator).toBeVisible();
        await expect(sealedRow.lockedImg.locator).toHaveAccessibleName(LOCKED_REASON);
        await expect(app.postAttributesModal.attribute(sealed).valueButton.locator).toHaveCount(0);
        await expect(app.postAttributesModal.attribute(sealed).clearButton.locator).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a value changed by another session reaches an open modal, without
 * closing or reloading it.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('updates an open modal when another session changes the value', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one select field and set it on a post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET, UNCLASSIFIED],
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'changed elsewhere'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, SECRET)},
        ]);

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);

        await openModalFromPostMenu(app, postOnScreen);
        await expect(app.postAttributesModal.locator).toBeVisible();

        const trigger = app.postAttributesModal.attribute(classification).valueButton.locator;
        await expect(trigger).toHaveText(SECRET);

        const loads = countLoads(page);

        // # Change the value from another session entirely
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, UNCLASSIFIED)},
        ]);

        // * Verify the open modal followed. No row holds a copy of its value, so there
        // is nothing staged for somebody else's write to have to beat.
        await expect(trigger).toHaveText(UNCLASSIFIED);

        // * Verify the chip behind it moved too, and that the modal survived
        await expect(postOnScreen.attributes.locator).toContainText(UNCLASSIFIED);
        await expect(app.postAttributesModal.locator).toBeVisible();
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the `…` menu reaches the modal on a post carrying no values at all,
 * and that the modal lists the channel's `always` fields.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('opens the modal on a post with no values, listing always fields', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one `always` field and one that only appears once set. Neither is
    // set on the post.
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET, UNCLASSIFIED],
            visibility: 'always',
            sortOrder: 1,
        });
        const caveat = await createField(adminClient, fieldName('caveat', suffix), {
            options: [NOFORN],
            visibility: 'when_set',
            sortOrder: 2,
        });
        created.push(classification, caveat);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'nothing set'});

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);

        // * Verify the post carries no chip row, so the menu is the only way in
        await expect(postOnScreen.locator).toContainText('nothing set');
        await expect(postOnScreen.attributes.locator).toHaveCount(0);

        // # Open the modal from the post's menu
        await openModalFromPostMenu(app, postOnScreen);

        const modal = app.postAttributesModal.locator;
        await expect(modal).toBeVisible();

        // * Verify the `always` field has a row waiting to be filled in, with a
        // control and nothing in it
        await expect(app.postAttributesModal.attribute(classification).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveText('');

        // * Verify it is genuinely writable from here, rather than a label on an
        // empty row
        await app.postAttributesModal
            .attribute(classification)
            .valueButton.clickTo(app.postAttributesModal.attribute(classification).valueMenu);
        const secretOption = app.postAttributesModal.attribute(classification).valueMenu.option({
            id: optionId(classification, SECRET),
        }).locator;
        await expect(secretOption).toBeVisible();
        await expect(secretOption).toHaveAttribute('role', 'menuitemradio');
        await expect(secretOption).toHaveAccessibleName(SECRET);
        await page.keyboard.press('Escape');

        // * Verify the `when_set` field is not listed. An unset field with no
        // instruction to appear is one the channel has not asked the author to fill in.
        await expect(app.postAttributesModal.attribute(caveat).locator).toHaveCount(0);

        // # Open the field picker
        const add = app.postAttributesModal.addButton.locator;

        await expect(add).toBeVisible();
        await add.click();

        // * Verify the picker offers the field the modal is not already showing, and
        // only that one. The `always` field has a row above, so offering it would be
        // a choice that changes nothing.
        await expect(app.postAttributesModal.addMenu.field(caveat).locator).toBeVisible();
        await expect(app.postAttributesModal.addMenu.field(classification).locator).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the whole add route: a field with no row is offered by the picker,
 * adding it draws an empty row without writing anything, setting a value on that row
 * puts a chip on the post behind, and the row survives the modal — it comes back from
 * the store on reopen, by which point the picker no longer offers the field.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('adds an attribute from the picker and gives it a first value', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    /*
     * # Provision two `when_set` fields, neither of them set on the post
     *
     * Only the first is ever touched. The second exists so that the picker still has
     * something to offer at the end: "the field left the picker" then reads against a
     * picker that is still on screen, rather than against the whole control having
     * been omitted — which is a different rule, and the next test's.
     */
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET, UNCLASSIFIED],
            visibility: 'when_set',
            sortOrder: 1,
        });
        const caveat = await createField(adminClient, fieldName('caveat', suffix), {
            options: [NOFORN],
            visibility: 'when_set',
            sortOrder: 2,
        });
        created.push(classification, caveat);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'nothing set yet'});

        const {app} = await pw.testBrowser.login(user);
        const {page} = app;
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chips = postOnScreen.attributes;

        // * Verify the post starts with no chip row at all, so the chip asserted at the
        // end arrived from this test's write rather than from the fixture
        await expect(postOnScreen.locator).toContainText('nothing set yet');
        await expect(chips.locator).toHaveCount(0);

        const loads = countLoads(page);

        // Every request this page makes to the values endpoint, collected so that
        // "adding wrote nothing" can be asserted against the wire rather than against
        // the absence of a control. Nothing reads values over HTTP either — they ride
        // on the post — so this stays empty until the write below.
        const writes = recordRequests(page, VALUES_ROUTE);

        // # Open the modal
        await openModalFromPostMenu(app, postOnScreen);

        const modal = app.postAttributesModal.locator;
        await expect(modal).toBeVisible();

        // * Verify neither unset `when_set` field has a row. There is nothing stored
        // and nothing asked for, so the modal has nothing to draw.
        await expect(app.postAttributesModal.attribute(classification).locator).toHaveCount(0);
        await expect(app.postAttributesModal.attribute(caveat).locator).toHaveCount(0);

        // # Add the first one from the picker
        const add = app.postAttributesModal.addButton.locator;

        await app.postAttributesModal.addButton.clickTo(app.postAttributesModal.addMenu);
        await app.postAttributesModal.addMenu.field(classification).click();

        // * Verify the row arrived with nothing in it
        await expect(app.postAttributesModal.attribute(classification).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveText('');

        // * Verify adding wrote nothing. The trash button appears only when there is
        // something to clear, so its absence is the row saying it holds no value — an
        // added row is a request for somewhere to type, not a value of its own.
        await expect(app.postAttributesModal.attribute(classification).clearButton.locator).toHaveCount(0);

        // * Verify that on the wire too. The row showing nothing to clear would also
        // be true of a write that stored an empty value, and an empty value is a real
        // row on the server that outlives this modal.
        expect(writes).toEqual([]);

        // * Verify the picker stopped offering the field the moment it gained a row,
        // before any value exists to make it a row on its own
        await add.click();
        await expect(app.postAttributesModal.addMenu.field(classification).locator).toHaveCount(0);
        await expect(app.postAttributesModal.addMenu.field(caveat).locator).toBeVisible();

        // # Add the second one too, and leave it empty. It is the control for the
        // reopen below: one added row gets a value and one does not, and only the
        // first has any reason to come back.
        await app.postAttributesModal.addMenu.field(caveat).click();
        await expect(app.postAttributesModal.attribute(caveat).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(caveat).valueButton.locator).toHaveText('');

        // # Set a value on the new row, waiting on the write itself rather than on
        // elapsed time
        await app.postAttributesModal
            .attribute(classification)
            .valueButton.clickTo(app.postAttributesModal.attribute(classification).valueMenu);
        await settle(
            app.postAttributesModal.attribute(classification).valueMenu.option({id: optionId(classification, SECRET)}),
            {wait: Api.UpdatePropertyValues},
        ).click();

        // # Close the modal
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();

        // * Verify the chip reached the post. The field is `when_set`, so the post had
        // no chip row at all until this write gave it one.
        await expect(optionChip(chips, SECRET)).toBeVisible();

        // # Reopen the modal
        await openModalFromPostMenu(app, postOnScreen);
        await expect(modal).toBeVisible();

        // * Verify the row that was given a value is still there, carrying it. This
        // row is store-derived: it exists because the post holds a value for the
        // field, not because somebody once pressed Add.
        await expect(app.postAttributesModal.attribute(classification).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveText(SECRET);

        // * Verify the row that was added and left empty is gone. The added set is
        // scoped to one opening of the modal and nothing was written, so there is
        // nothing for the row to have been made of — which is also what makes the
        // assertion above about the store rather than about the set.
        await expect(app.postAttributesModal.attribute(caveat).locator).toHaveCount(0);

        // * Verify the picker offers the empty field again and still not the one with
        // a value
        await add.click();
        await expect(app.postAttributesModal.addMenu.field(caveat).locator).toBeVisible();
        await expect(app.postAttributesModal.addMenu.field(classification).locator).toHaveCount(0);

        // * Verify nothing reloaded the page to get any of this
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a modal with nothing left to offer omits the field picker
 * altogether, rather than showing a control that can do nothing.
 *
 * @precondition The PostAttributes feature flag is enabled.
 *
 * @precondition No other spec is creating system-scoped post attribute fields at the
 * same time. This is the one test here asserting the *absence* of candidates, and a
 * system-scoped field applies to every channel, so another spec's field would bring
 * the picker back. CI pins `PW_WORKERS: 1`, which holds it.
 */
test('omits the field picker when every field already has a row', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one `always` field, and nothing else. It is a `select` writable by
    // any member, so it is a field the picker *would* offer; the only thing keeping it
    // out of the candidate list is that it already has a row.
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [SECRET, UNCLASSIFIED],
            visibility: 'always',
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'all fields on show'});

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);

        // # Open the modal
        await openModalFromPostMenu(app, postOnScreen);

        const modal = app.postAttributesModal.locator;
        await expect(modal).toBeVisible();

        // * Verify the field has its row, unset and waiting
        await expect(app.postAttributesModal.attribute(classification).locator).toBeVisible();
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveText('');

        // * Verify the user may write it. Without this the picker's absence would have
        // a second explanation — a field nobody may fill in is not a candidate either.
        await expect(app.postAttributesModal.attribute(classification).valueButton.locator).toHaveCount(1);

        // * Verify there is no picker at all. Omitted rather than disabled: a channel
        // that declares all its fields `always` would otherwise show a permanently dead
        // `+ Add attribute` on every post, which is the only control those users see
        // here.
        await expect(app.postAttributesModal.addButton.locator).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});
