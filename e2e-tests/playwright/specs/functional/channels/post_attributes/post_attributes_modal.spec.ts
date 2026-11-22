// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, postWith, settle, test, waitForApi, type App} from '@mattermost/playwright-lib';

import {concealedPost} from '../burn_on_read/support';

import {
    GROUP,
    OBJECT_TYPE,
    activeSystemFields,
    countLoads,
    createField,
    deleteFields,
    dropFieldUpdates,
    fieldName,
    openModalFromPostMenu,
    optionId,
    purgeFields,
    setPostValues,
    skipIfNoPostAttributesLicense,
} from './support';

type Post = ReturnType<App['center']['postList']['post']>;
type Modal = App['postAttributesModal'];

/**
 * Opens the post's `…` menu from the keyboard and leaves it open, for asserting what it
 * offers. The pointer is not used to open it: on a post near the bottom of the window the
 * menu opens upward under the pointer, and the item it lands on opens a submenu.
 */
async function openPostMenu(app: App, post: Post) {
    await post.message.container.hover();
    await expect(post.menu.dotMenuButton).toBeVisible();
    await post.menu.dotMenuButton.pressTo('Enter', app.postDotMenu);
}

/** Closes the post menu that `openPostMenu` left open. */
async function closePostMenu(app: App) {
    await app.page.keyboard.press('Escape');
    await expect(app.postDotMenu).toBeHidden();
}

/**
 * Adds an attribute to the open modal from its picker, which gives the field an empty row
 * and writes nothing.
 */
async function addAttribute(modal: Modal, field: PropertyField) {
    await modal.addButton.clickTo(modal.addMenu);
    await modal.addMenu.field(field).clickTo(modal.attribute(field).container);
}

/**
 * @objective Verify the attributes modal opens from the post's `…` menu and from the hover
 * card's `Edit`, and that both land on the same post's rows.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('opens from the post menu and from the hover card', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a select field and set it on a post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(level);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: `two ways in ${suffix}`});
        await setPostValues(adminClient, post.id, [{field_id: level.id, value: optionId(level, 'High')}]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const modal = app.postAttributesModal;

        // # Open the modal from the post's menu
        await openModalFromPostMenu(app, postOnScreen);

        // * Verify it shows the post's row with its value
        await expect(modal.attribute(level).container).toBeVisible();
        await expect(modal.attribute(level).valueButton).toHaveText('High');

        // # Close it, then open it from the hover card
        await app.page.keyboard.press('Escape');
        await expect(modal.container).toBeHidden();

        await postOnScreen.attributes.container.hover();
        const card = app.postAttributesCard;
        await expect(card.container).toBeVisible();
        await card.editButton.clickTo(modal);

        // * Verify the same modal opened on the same post, and the card went away
        await expect(modal.attribute(level).container).toBeVisible();
        await expect(modal.attribute(level).valueButton).toHaveText('High');
        await expect(card.container).toBeHidden();
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the `…` menu offers no Attributes item on a post where the user has
 * nothing to view or add, and offers it once something appears, without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled, and no system-scoped post
 * attribute field exists that this suite didn't create: one the user could write would
 * give the menu something to add. It skips when the server has one.
 */
test('offers no Attributes item when there is nothing to view or add', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one field only a system admin may write, and leave it unset. A member
    // can neither view it (nothing is stored) nor add it (they may not write it).
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const others = await activeSystemFields(adminClient);
        test.skip(others.length > 0, `${others.length} other post attribute fields exist on the server`);

        const restricted = await createField(adminClient, fieldName('restricted', suffix), {
            options: ['NOFORN'],
            permissionValues: 'sysadmin',
        });
        created.push(restricted);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: `nothing here ${suffix}`});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const loads = countLoads(page);

        // # Open the post's menu
        await openPostMenu(app, postOnScreen);

        // * Verify the menu is there, with other items, and has no Attributes item
        await expect(app.postDotMenu.copyLinkMenuItem).toBeVisible();
        await expect(app.postDotMenu.postAttributesMenuItem).toHaveCount(0);
        await closePostMenu(app);

        // # A value appears on the post, for a field the member still cannot write
        await setPostValues(adminClient, post.id, [{field_id: restricted.id, value: optionId(restricted, 'NOFORN')}]);
        await expect(postOnScreen.attributes.container).toContainText('NOFORN');

        // * Verify there is now something to view, so the item is offered, and the modal
        // shows it locked
        const modal = await openModalFromPostMenu(app, postOnScreen);
        await expect(modal.attribute(restricted).container).toContainText('NOFORN');
        await expect(modal.attribute(restricted).valueButton).toHaveCount(0);

        // * Verify none of it reloaded the page
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the `…` menu has no Attributes item on a system message or on a
 * burn-on-read post that has not been revealed, even when the channel declares a field the
 * user could write.
 *
 * @precondition The PostAttributes and BurnOnRead features are enabled.
 */
test(
    'offers no Attributes item on system messages or concealed burn-on-read posts',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);
        await pw.ensureLicense();
        await skipIfNoPostAttributesLicense();

        // # Provision an `always` field any member may write, so an ordinary post would offer
        // the item
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];
        const config = await adminClient.getConfig();

        try {
            await purgeFields(adminClient);
            await adminClient.patchConfig({ServiceSettings: {...config.ServiceSettings, EnableBurnOnRead: true}});

            const level = await createField(adminClient, fieldName('level', suffix), {
                options: ['Low', 'High'],
                visibility: 'always',
            });
            created.push(level);

            // The one who looks is a second user, so the burn-on-read post below is somebody
            // else's and arrives concealed
            const [receiver] = await adminClient.createUsers(team.id, 1);

            // A system message, made by changing a channel's header, and an ordinary post
            // next to it
            const channel = await adminClient.createPublicChannel(team.id, `menu-${suffix}`);
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.addToChannel(receiver.id, channel.id);
            await adminClient.patchChannel(channel.id, {header: `header ${suffix}`});
            const ordinary = await userClient.createTestPost({channel_id: channel.id, message: `ordinary ${suffix}`});

            // A burn-on-read post in a DM between the two
            const dm = await adminClient.createDirectChannel([user.id, receiver.id]);
            await userClient.createPost({
                channel_id: dm.id,
                message: `burn after reading ${suffix}`,
                type: 'burn_on_read',
            });

            const {app} = await pw.testBrowser.login(receiver);
            await app.channelsPage.goto({team, channel});

            // * Verify the ordinary post offers the item, so the absences below are about the
            // kind of post
            const ordinaryOnScreen = app.center.postList.post(ordinary);
            await openPostMenu(app, ordinaryOnScreen);
            await expect(app.postDotMenu.postAttributesMenuItem).toBeVisible();
            await closePostMenu(app);

            // * Verify the system message has no `…` menu at all, so there is no way to the
            // modal from it
            const systemOnScreen = await postWith(app.center.postList, {text: `header ${suffix}`});

            // The header change is a system post, which the list marks with its own class
            await expect(systemOnScreen.container).toHaveClass(/post--system/);
            await systemOnScreen.container.hover();
            await expect(systemOnScreen.menu.dotMenuButton).toBeHidden();

            // # Look at the concealed burn-on-read post from the DM
            await app.channelsPage.goto({team, path: 'messages', channel: `@${user.username}`});

            const concealed = await concealedPost(app);
            await expect(concealed.post.revealButton).toBeVisible();

            // * Verify its menu opens, with other items, and has no Attributes item
            await concealed.post.container.hover();
            await concealed.post.menu.dotMenuButton.pressTo('Enter', app.postDotMenu);
            await expect(app.postDotMenu.remindMenuItem).toBeVisible();
            await expect(app.postDotMenu.postAttributesMenuItem).toHaveCount(0);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify a text attribute can be filled in from the modal, committing on Enter
 * and on blur, and that each change shows on the post's chip without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('writes a text attribute on Enter and on blur', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a when_set text field and a post with no values
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: `text ${suffix}`});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chip = postOnScreen.attributes.value.textText;
        const loads = countLoads(page);
        const write = {wait: Api.UpdatePropertyValues, params: {target_id: post.id}};

        // # Add the field in the modal
        const modal = await openModalFromPostMenu(app, postOnScreen);
        await addAttribute(modal, note);

        // # Type a value and press Enter
        const input = modal.attribute(note).valueInputTextbox;
        await input.fill('first draft');
        await settle(input, write).press('Enter');

        // * Verify Enter wrote it and the chip shows it
        await expect(chip).toHaveText('first draft');

        // # Change it and leave the field by clicking elsewhere in the modal
        await input.fill('second draft');
        await settle(modal.reprise, write).click();

        // * Verify leaving the field wrote it too
        await expect(chip).toHaveText('second draft');

        // * Verify the modal is still open and nothing reloaded
        await expect(modal.container).toBeVisible();
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the user and multiuser attributes can be filled in from the modal: the
 * picker's list opens above the modal where it can be clicked, and each pick shows on the
 * post's chips without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'writes user and multiuser attributes through a picker above the modal',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision a user and a multiuser field, two people to pick, and a post with no values
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const owner = await createField(adminClient, fieldName('owner', suffix), {type: 'user', sortOrder: 1});
            const reviewers = await createField(adminClient, fieldName('reviewers', suffix), {
                type: 'multiuser',
                sortOrder: 2,
            });
            created.push(owner, reviewers);

            const alice = await adminClient.createUser(await pw.random.user('alice'), '', '');
            const bob = await adminClient.createUser(await pw.random.user('bob'), '', '');
            await adminClient.addToTeam(team.id, alice.id);
            await adminClient.addToTeam(team.id, bob.id);

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createTestPost({channel_id: channel.id, message: `users ${suffix}`});

            const {app, page} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel});

            const postOnScreen = app.center.postList.post(post);
            const userChips = postOnScreen.attributes.value.user;
            const loads = countLoads(page);

            // # Add the single user field and search for someone
            const modal = await openModalFromPostMenu(app, postOnScreen);
            await addAttribute(modal, owner);

            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker is the shared react-select UserSelector, which gives its input and its options no test id; the input is found inside the generated group that wraps it
            const ownerInput = modal.attribute(owner).users.locator.locator('input');
            await ownerInput.fill(alice.username);

            // * Verify the list of matches is on top of the modal: it is inside the dialog's
            // stacking, and clicking it reaches the option rather than the modal behind
            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
            const aliceOption = app.page.getByRole('option', {name: new RegExp(alice.username)});
            await expect(aliceOption).toBeVisible();

            await Promise.all([
                waitForApi(page, Api.UpdatePropertyValues, {params: {target_id: post.id}}),
                aliceOption.click(),
            ]);

            // * Verify the pick wrote and the post's chip names the person
            await expect(userChips).toHaveCount(1);
            await expect(userChips).toContainText(alice.username);

            // # Add the multiuser field and pick two people
            await addAttribute(modal, reviewers);

            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker is the shared react-select UserSelector, which gives its input and its options no test id; the input is found inside the generated group that wraps it
            const reviewersInput = modal.attribute(reviewers).users.locator.locator('input');

            await reviewersInput.fill(alice.username);

            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
            const aliceReviewer = app.page.getByRole('option', {name: new RegExp(alice.username)});
            await Promise.all([
                waitForApi(page, Api.UpdatePropertyValues, {params: {target_id: post.id}}),
                aliceReviewer.click(),
            ]);

            await reviewersInput.fill(bob.username);

            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
            const bobReviewer = app.page.getByRole('option', {name: new RegExp(bob.username)});
            await Promise.all([
                waitForApi(page, Api.UpdatePropertyValues, {params: {target_id: post.id}}),
                bobReviewer.click(),
            ]);

            // * Verify the post carries a chip for the owner and one per reviewer. The row
            // draws only two chips, so the card, which lists every value, is read for the rest.
            await app.page.keyboard.press('Escape');
            await expect(modal.container).toBeHidden();
            await postOnScreen.attributes.container.hover();

            const card = app.postAttributesCard;
            await expect(card.container).toBeVisible();
            await expect(card.attributeList).toHaveKeyCount(2);

            const rows = await card.attributeList.keys();
            await expect(card.attribute(rows[0]).container).toContainText(alice.username);
            await expect(card.attribute(rows[1]).container).toContainText(alice.username);
            await expect(card.attribute(rows[1]).container).toContainText(bob.username);

            // * Verify nothing reloaded the page
            expect(loads()).toBe(0);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify the select, rank and multiselect attributes can be filled in from the
 * modal: a multiselect toggles several options on and one off, and each change shows on the
 * post's chips without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('writes select, rank and multiselect attributes', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a rank and a multiselect field, and a post with no values
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const rank = await createField(adminClient, fieldName('rank', suffix), {
            type: 'rank',
            options: ['First', 'Second'],
            sortOrder: 1,
        });
        const colours = await createField(adminClient, fieldName('colours', suffix), {
            type: 'multiselect',
            options: ['Red', 'Green', 'Blue'],
            sortOrder: 2,
        });
        created.push(rank, colours);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: `options ${suffix}`});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        const postOnScreen = app.center.postList.post(post);
        const chips = postOnScreen.attributes.value.selectText;
        const loads = countLoads(page);
        const write = {wait: Api.UpdatePropertyValues, params: {target_id: post.id}};

        // # Add the rank field and pick an option
        const modal = await openModalFromPostMenu(app, postOnScreen);
        await addAttribute(modal, rank);

        const rankRow = modal.attribute(rank);
        await rankRow.valueButton.clickTo(rankRow.valueMenu);
        await settle(rankRow.valueMenu.option(optionId(rank, 'Second')), write).click();

        // * Verify the rank value is on the post
        await expect(chips).toHaveText('Second');

        // # Add the multiselect and tick two options. The menu stays open between picks.
        await addAttribute(modal, colours);

        const coloursRow = modal.attribute(colours);
        const red = coloursRow.valueMenu.option(optionId(colours, 'Red'));
        const green = coloursRow.valueMenu.option(optionId(colours, 'Green'));
        const blue = coloursRow.valueMenu.option(optionId(colours, 'Blue'));
        await coloursRow.valueButton.clickTo(coloursRow.valueMenu);

        await settle(red, write).click();
        await settle(blue, write).click();

        // * Verify the menu is still open with both options ticked, and the post has the
        // rank chip and one chip per ticked colour, in the order they were ticked
        await expect(red).toHaveAttribute('aria-checked', 'true');
        await expect(blue).toHaveAttribute('aria-checked', 'true');
        await expect(green).toHaveAttribute('aria-checked', 'false');
        await expect(chips).toHaveText(['Second', 'Red']);

        // # Untick the first option
        await settle(red, write).click();

        // * Verify only the unticked option left, and the other one stayed
        await expect(red).toHaveAttribute('aria-checked', 'false');
        await expect(chips).toHaveText(['Second', 'Blue']);

        // * Verify nothing reloaded the page
        expect(loads()).toBe(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the picker in the modal, with five or more fields to offer, opens with
 * its search box focused inside the dialog, filters as the user types, and closes on Escape
 * without closing the modal.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'searches the field picker inside the modal, and Escape closes only the menu',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision five fields, none set on the post
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
            const fields: Record<string, PropertyField> = {};
            for (const [index, name] of names.entries()) {
                fields[name] = await createField(adminClient, fieldName(name, suffix), {
                    type: 'text',
                    sortOrder: index,
                });
                created.push(fields[name]);
            }

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createTestPost({channel_id: channel.id, message: `search ${suffix}`});

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel});

            const postOnScreen = app.center.postList.post(post);

            // # Open the modal and the picker
            const modal = await openModalFromPostMenu(app, postOnScreen);
            await modal.addButton.clickTo(modal.addMenu);

            // * Verify the search box is inside the dialog and has the focus, so typing
            // reaches it: the modal takes back any focus that leaves it
            const search = modal.addMenu.searchTextbox;
            await expect(search).toBeVisible();
            await expect(search).toBeFocused();

            const dialog = await modal.container.locator.elementHandle();
            const inside = await search.locator.evaluate(
                (box, dialogElement) => Boolean(dialogElement?.contains(box)),
                dialog,
            );
            expect(inside, 'the search box should be inside the dialog').toBe(true);

            // * Verify all five fields are offered
            for (const name of names) {
                await expect(modal.addMenu.field(fields[name])).toBeVisible();
            }

            // # Search for part of one field's name
            await search.type('rav');

            // * Verify only the match is left
            await expect(modal.addMenu.field(fields.bravo)).toBeVisible();
            await expect(modal.addMenu.field(fields.alpha)).toHaveCount(0);
            await expect(modal.addMenu.field(fields.echo)).toHaveCount(0);

            // # Escape
            await search.press('Escape');

            // * Verify the menu closed and the modal did not
            await expect(modal.addMenu.field(fields.bravo)).toHaveCount(0);
            await expect(modal.container).toBeVisible();

            // # Open the picker again
            await modal.addButton.clickTo(modal.addMenu);

            // * Verify the search starts empty with every field back
            await expect(search).toHaveValue('');
            await expect(modal.addMenu.field(fields.alpha)).toBeVisible();

            // # Narrow the list to one field, so the first entry is it whatever other fields
            // the server has, then move into the list and pick it
            await search.type(`alpha_${suffix}`);
            await search.press('ArrowDown');
            await expect(modal.addMenu.field(fields.alpha)).toBeFocused();
            await modal.addMenu.field(fields.alpha).pressTo('Enter', modal.attribute(fields.alpha).container);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify clearing an attribute drops it from the post's hover card, and from the
 * modal on reopen for a `when_set` field, while an `always` field keeps an empty row.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'removes a cleared attribute from the card, and from the modal unless it is always',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision three fields and set all three on one post: an `always` one and a
        // `when_set` one to clear, and a second `when_set` one to keep the card on screen
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const always = await createField(adminClient, fieldName('always', suffix), {
                options: ['SECRET'],
                visibility: 'always',
                sortOrder: 1,
            });
            const whenSet = await createField(adminClient, fieldName('whenset', suffix), {
                options: ['NOFORN'],
                visibility: 'when_set',
                sortOrder: 2,
            });
            const kept = await createField(adminClient, fieldName('kept', suffix), {
                options: ['ORCON'],
                visibility: 'when_set',
                sortOrder: 3,
            });
            created.push(always, whenSet, kept);

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createTestPost({channel_id: channel.id, message: `removing ${suffix}`});
            await setPostValues(adminClient, post.id, [
                {field_id: always.id, value: optionId(always, 'SECRET')},
                {field_id: whenSet.id, value: optionId(whenSet, 'NOFORN')},
                {field_id: kept.id, value: optionId(kept, 'ORCON')},
            ]);

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel});

            const postOnScreen = app.center.postList.post(post);
            const chips = postOnScreen.attributes;
            const write = {wait: Api.UpdatePropertyValues, params: {target_id: post.id}};

            // # Clear both attributes from the modal
            const modal = await openModalFromPostMenu(app, postOnScreen);

            await settle(modal.attribute(always).clearButton, write).click();
            await settle(modal.attribute(whenSet).clearButton, write).click();

            // * Verify the chips are gone and the one left is the one never touched
            await expect(chips.container).not.toContainText('SECRET');
            await expect(chips.container).not.toContainText('NOFORN');
            await expect(chips.container).toContainText('ORCON');

            // # Close the modal and hover the chip row
            await app.page.keyboard.press('Escape');
            await expect(modal.container).toBeHidden();
            await chips.container.hover();

            // * Verify the card lists only the attribute that kept its value
            const card = app.postAttributesCard;
            await expect(card.container).toBeVisible();
            await expect(card.attributeList).toHaveKeyCount(1);
            await expect(card.container).toContainText('ORCON');
            await expect(card.container).not.toContainText(always.name);
            await expect(card.container).not.toContainText(whenSet.name);

            // # Reopen the modal
            await app.page.mouse.move(5, 5);
            await expect(card.container).toBeHidden();
            await openModalFromPostMenu(app, postOnScreen);

            // * Verify the `always` field kept an empty row it can be filled in from, the
            // `when_set` one is gone, and the one with a value is still there
            await expect(modal.attribute(always).container).toBeVisible();
            await expect(modal.attribute(always).valueButton).toHaveText('');
            await expect(modal.attribute(whenSet).container).toHaveCount(0);
            await expect(modal.attribute(kept).container).toBeVisible();
            await expect(modal.attribute(kept).valueButton).toHaveText('ORCON');

            // * Verify the picker offers the field that lost its row again
            await modal.addButton.clickTo(modal.addMenu);
            await expect(modal.addMenu.field(whenSet)).toBeVisible();
            await expect(modal.addMenu.field(always)).toHaveCount(0);
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify a write the server refuses while the modal is open shows the permission
 * message on that row and leaves the chip on the post with its old value.
 *
 * The field is linked to a template, so its `permission_values` can be patched from `member`
 * to `sysadmin` after the modal opened. The page does not get the field's
 * `property_field_updated` websocket event (`dropFieldUpdates` filters it on the page's own
 * socket): with it the modal would lock the row before the pick and no write would be
 * attempted, so there would be nothing to refuse. The server still enforces the new level,
 * which is what refuses the write.
 *
 * @precondition The PostAttributes feature flag is enabled, and the server has an
 * Enterprise-level licence (Entry counts).
 */
test(
    'shows the refusal on the row when a write is refused, and keeps the chip',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        // # Provision a member-writable select field and set one value on the user's post
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const level = await createField(adminClient, fieldName('level', suffix), {
                options: ['Low', 'High'],
                permissionValues: 'member',
                visibility: 'always',
            });
            created.push(level);

            const channel = await adminClient.getChannelByName(team.id, 'town-square');
            const post = await userClient.createTestPost({channel_id: channel.id, message: `refused write ${suffix}`});
            await setPostValues(adminClient, post.id, [{field_id: level.id, value: optionId(level, 'Low')}]);

            const {app, page} = await pw.testBrowser.login(user);
            await dropFieldUpdates(page);
            await app.channelsPage.goto({team, channel});

            const postOnScreen = app.center.postList.post(post);
            const chip = postOnScreen.attributes.value.selectText;
            await expect(chip).toHaveText('Low');

            // # Open the modal, then take the permission away from members. The page is not told.
            const modal = await openModalFromPostMenu(app, postOnScreen);
            const row = modal.attribute(level);
            await expect(row.valueButton).toHaveText('Low');
            await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, level.id, {permission_values: 'sysadmin'});

            // # Pick the other option
            await row.valueButton.clickTo(row.valueMenu);
            await settle(row.valueMenu.option(optionId(level, 'High')), {
                wait: Api.UpdatePropertyValues,
                params: {target_id: post.id},
                status: 403,
            }).click();

            // * Verify the server refused it, and the row says so
            await expect(modal.error(level)).toHaveText('You do not have permission to change this attribute');

            // * Verify the chip on the post and the row both still hold the old value
            await expect(chip).toHaveText('Low');
            await expect(row.valueButton).toHaveText('Low');
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);
