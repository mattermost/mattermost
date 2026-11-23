// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {PropertyField} from '@mattermost/types/properties';

import type {ChannelsPage, ChannelsPost} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    OBJECT_TYPE,
    activeSystemFields,
    countLoads,
    createField,
    deleteFields,
    dropFieldUpdates,
    fieldName,
    modalClear,
    modalInput,
    modalRow,
    modalTrigger,
    openModalFromPostMenu,
    optionId,
    pickerItem,
    purgeFields,
    setPostValues,
    VALUES_ROUTE,
    skipIfNoPostAttributesLicense,
} from './support';

const CHIPS = 'post-attributes-chips';
const CARD = 'post-attributes-card';
const OPTION_CHIP = 'select-property';
const TEXT_CHIP = 'text-property';
const USER_CHIP = 'user-property';

// `GenericModal` renders `role='none'`, so the element id it forwards is the only stable
// handle on the modal itself.
const MODAL = '#postAttributesModal';

/**
 * Opens the post's `…` menu from the keyboard and leaves it open, for asserting what it
 * offers. The pointer is not used to open it: on a post near the bottom of the window the
 * menu opens upward under the pointer, and the item it lands on opens a submenu.
 */
async function openPostMenu(channelsPage: ChannelsPage, post: ChannelsPost) {
    await post.messageText.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.press('Enter');
    await channelsPage.postDotMenu.toBeVisible();
}

/**
 * Resolves with the response to the next write of values on a post. Arm it before the
 * action that writes, or the response is missed.
 */
function waitForWrite(page: Page, postId: string) {
    return page.waitForResponse(
        (response) => response.url().includes(`${VALUES_ROUTE}${postId}`) && response.request().method() === 'PATCH',
    );
}

/**
 * Adds an attribute to the open modal from its picker, which gives the field an empty row
 * and writes nothing.
 */
async function addAttribute(page: Page, field: PropertyField) {
    await page.getByTestId('post-attributes-add').click();
    await pickerItem(page, field).click();
    await expect(modalRow(page, field)).toBeVisible();
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const modal = page.locator(MODAL);

        // # Open the modal from the post's menu
        await openModalFromPostMenu(channelsPage, postOnScreen);

        // * Verify it shows the post's row with its value
        await expect(modal).toBeVisible();
        await expect(modalRow(page, level)).toBeVisible();
        await expect(modalTrigger(page, level)).toHaveText('High');

        // # Close it, then open it from the hover card
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();

        await postOnScreen.container.getByTestId(CHIPS).hover();
        const card = page.getByTestId(CARD);
        await expect(card).toBeVisible();
        await card.getByRole('button', {name: 'Edit'}).click();

        // * Verify the same modal opened on the same post, and the card went away
        await expect(modal).toBeVisible();
        await expect(modalRow(page, level)).toBeVisible();
        await expect(modalTrigger(page, level)).toHaveText('High');
        await expect(card).toBeHidden();
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const loads = countLoads(page);

        // # Open the post's menu
        await openPostMenu(channelsPage, postOnScreen);

        // * Verify the menu is there, with other items, and has no Attributes item
        const menu = channelsPage.postDotMenu.container;
        await expect(menu.getByRole('menuitem', {name: 'Copy Link'})).toBeVisible();
        await expect(menu.getByRole('menuitem', {name: 'Attributes'})).toHaveCount(0);
        await page.keyboard.press('Escape');

        // # A value appears on the post, for a field the member still cannot write
        await setPostValues(adminClient, post.id, [{field_id: restricted.id, value: optionId(restricted, 'NOFORN')}]);
        await expect(postOnScreen.container.getByTestId(CHIPS)).toContainText('NOFORN');

        // * Verify there is now something to view, so the item is offered, and the modal
        // shows it locked
        await openModalFromPostMenu(channelsPage, postOnScreen);
        await expect(page.locator(MODAL)).toBeVisible();
        await expect(modalRow(page, restricted)).toContainText('NOFORN');
        await expect(modalTrigger(page, restricted)).toHaveCount(0);

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

            const posts = await adminClient.getPosts(channel.id);
            const system = Object.values(posts.posts).find((post) => post.type === 'system_header_change');
            expect(system).toBeDefined();

            // A burn-on-read post in a DM between the two
            const dm = await adminClient.createDirectChannel([user.id, receiver.id]);
            await userClient.createPost({
                channel_id: dm.id,
                message: `burn after reading ${suffix}`,
                type: 'burn_on_read',
            });

            const {page, channelsPage} = await pw.testBrowser.login(receiver);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Verify the ordinary post offers the item, so the absences below are about the
            // kind of post
            const ordinaryOnScreen = await channelsPage.centerView.getPostById(ordinary.id);
            await openPostMenu(channelsPage, ordinaryOnScreen);
            await expect(channelsPage.postDotMenu.container.getByRole('menuitem', {name: 'Attributes'})).toBeVisible();
            await page.keyboard.press('Escape');

            // * Verify the system message has no `…` menu at all, so there is no way to the
            // modal from it
            const systemOnScreen = await channelsPage.centerView.getPostById(system!.id);
            await systemOnScreen.toBeSystemMessage();
            await systemOnScreen.container.hover();
            await expect(systemOnScreen.postMenu.dotMenuButton).toBeHidden();

            // # Look at the concealed burn-on-read post from the DM
            await channelsPage.goto(team.name, `@${user.username}`);
            await channelsPage.toBeVisible();

            const concealed = await channelsPage.centerView.getConcealedBorPost();
            await expect(concealed.concealedPlaceholder.container).toBeVisible();

            // * Verify its menu opens, with other items, and has no Attributes item
            await concealed.container.hover();
            await concealed.postMenu.dotMenuButton.press('Enter');
            await channelsPage.postDotMenu.toBeVisible();
            await expect(channelsPage.postDotMenu.container.getByRole('menuitem', {name: /Remind/})).toBeVisible();
            await expect(channelsPage.postDotMenu.container.getByRole('menuitem', {name: 'Attributes'})).toHaveCount(0);
        } finally {
            await deleteFields(adminClient, created);
            await adminClient.patchConfig({
                ServiceSettings: {EnableBurnOnRead: config.ServiceSettings.EnableBurnOnRead},
            });
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const chip = postOnScreen.container.getByTestId(CHIPS).getByTestId(TEXT_CHIP);
        const loads = countLoads(page);

        // # Add the field in the modal
        await openModalFromPostMenu(channelsPage, postOnScreen);
        await addAttribute(page, note);

        // # Type a value and press Enter
        await modalInput(page, note).fill('first draft');
        let written = waitForWrite(page, post.id);
        await modalInput(page, note).press('Enter');

        // * Verify Enter wrote it and the chip shows it
        expect((await written).status()).toBe(200);
        await expect(chip).toHaveText('first draft');

        // # Change it and leave the field by clicking elsewhere in the modal
        await modalInput(page, note).fill('second draft');
        written = waitForWrite(page, post.id);
        await page.getByTestId('post-attributes-reprise').click();

        // * Verify leaving the field wrote it too
        expect((await written).status()).toBe(200);
        await expect(chip).toHaveText('second draft');

        // * Verify the modal is still open and nothing reloaded
        await expect(page.locator(MODAL)).toBeVisible();
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const postOnScreen = await channelsPage.centerView.getPostById(post.id);
            const userChips = postOnScreen.container.getByTestId(CHIPS).getByTestId(USER_CHIP);
            const loads = countLoads(page);

            // # Add the single user field and search for someone
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await addAttribute(page, owner);

            const ownerInput = page.getByTestId(`post-attribute-user-${owner.name}`).locator('input');
            await ownerInput.fill(alice.username);

            // * Verify the list of matches is on top of the modal: it is inside the dialog's
            // stacking, and clicking it reaches the option rather than the modal behind
            const aliceOption = page.getByRole('option', {name: new RegExp(alice.username)});
            await expect(aliceOption).toBeVisible();

            const written = waitForWrite(page, post.id);
            await aliceOption.click();

            // * Verify the pick wrote and the post's chip names the person
            expect((await written).status()).toBe(200);
            await expect(userChips).toHaveCount(1);
            await expect(userChips.first()).toContainText(alice.username);

            // # Add the multiuser field and pick two people
            await addAttribute(page, reviewers);

            const reviewersInput = page.getByTestId(`post-attribute-user-${reviewers.name}`).locator('input');

            await reviewersInput.fill(alice.username);
            let write = waitForWrite(page, post.id);
            await page.getByRole('option', {name: new RegExp(alice.username)}).click();
            expect((await write).status()).toBe(200);

            await reviewersInput.fill(bob.username);
            write = waitForWrite(page, post.id);
            await page.getByRole('option', {name: new RegExp(bob.username)}).click();
            expect((await write).status()).toBe(200);

            // * Verify the post carries a chip for the owner and one per reviewer. The row
            // draws only two chips, so the card, which lists every value, is read for the rest.
            await page.keyboard.press('Escape');
            await expect(page.locator(MODAL)).toBeHidden();
            await postOnScreen.container.getByTestId(CHIPS).hover();

            const card = page.getByTestId(CARD);
            await expect(card).toBeVisible();
            await expect(card.getByRole('listitem')).toHaveCount(2);
            await expect(card.getByRole('listitem').nth(0)).toContainText(alice.username);
            await expect(card.getByRole('listitem').nth(1)).toContainText(alice.username);
            await expect(card.getByRole('listitem').nth(1)).toContainText(bob.username);

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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        const chips = postOnScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP);
        const loads = countLoads(page);

        // # Add the rank field and pick an option
        await openModalFromPostMenu(channelsPage, postOnScreen);
        await addAttribute(page, rank);
        await modalTrigger(page, rank).click();

        let write = waitForWrite(page, post.id);
        await page.getByRole('menuitemradio', {name: 'Second', exact: true}).click();
        expect((await write).status()).toBe(200);

        // * Verify the rank value is on the post
        await expect(chips).toHaveText('Second');

        // # Add the multiselect and tick two options. The menu stays open between picks.
        await addAttribute(page, colours);
        await modalTrigger(page, colours).click();

        write = waitForWrite(page, post.id);
        await page.getByRole('menuitemcheckbox', {name: 'Red', exact: true}).click();
        expect((await write).status()).toBe(200);

        write = waitForWrite(page, post.id);
        await page.getByRole('menuitemcheckbox', {name: 'Blue', exact: true}).click();
        expect((await write).status()).toBe(200);

        // * Verify the menu is still open with both options ticked, and the post has the
        // rank chip and one chip per ticked colour, in the order they were ticked
        await expect(page.getByRole('menuitemcheckbox', {name: 'Red', exact: true})).toHaveAttribute(
            'aria-checked',
            'true',
        );
        await expect(page.getByRole('menuitemcheckbox', {name: 'Blue', exact: true})).toHaveAttribute(
            'aria-checked',
            'true',
        );
        await expect(page.getByRole('menuitemcheckbox', {name: 'Green', exact: true})).toHaveAttribute(
            'aria-checked',
            'false',
        );
        await expect(chips).toHaveText(['Second', 'Red']);

        // # Untick the first option
        write = waitForWrite(page, post.id);
        await page.getByRole('menuitemcheckbox', {name: 'Red', exact: true}).click();
        expect((await write).status()).toBe(200);

        // * Verify only the unticked option left, and the other one stayed
        await expect(page.getByRole('menuitemcheckbox', {name: 'Red', exact: true})).toHaveAttribute(
            'aria-checked',
            'false',
        );
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const postOnScreen = await channelsPage.centerView.getPostById(post.id);
            const modal = page.locator(MODAL);

            // # Open the modal and the picker
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await expect(modal).toBeVisible();
            await page.getByTestId('post-attributes-add').click();

            // * Verify the search box is inside the dialog and has the focus, so typing
            // reaches it: the modal takes back any focus that leaves it
            const search = page.getByTestId('post-attributes-add-search');
            await expect(search).toBeVisible();
            await expect(modal.getByTestId('post-attributes-add-search')).toHaveCount(1);
            await expect(search).toBeFocused();

            // * Verify all five fields are offered
            for (const name of names) {
                await expect(pickerItem(page, fields[name])).toBeVisible();
            }

            // # Search for part of one field's name
            await page.keyboard.type('rav');

            // * Verify only the match is left
            await expect(pickerItem(page, fields.bravo)).toBeVisible();
            await expect(pickerItem(page, fields.alpha)).toHaveCount(0);
            await expect(pickerItem(page, fields.echo)).toHaveCount(0);

            // # Escape
            await page.keyboard.press('Escape');

            // * Verify the menu closed and the modal did not
            await expect(pickerItem(page, fields.bravo)).toHaveCount(0);
            await expect(modal).toBeVisible();

            // # Open the picker again
            await page.getByTestId('post-attributes-add').click();

            // * Verify the search starts empty with every field back
            await expect(search).toHaveValue('');
            await expect(pickerItem(page, fields.alpha)).toBeVisible();

            // # Narrow the list to one field, so the first entry is it whatever other fields
            // the server has, then move into the list and pick it
            await page.keyboard.type(`alpha_${suffix}`);
            await page.keyboard.press('ArrowDown');
            await expect(pickerItem(page, fields.alpha)).toBeFocused();
            await page.keyboard.press('Enter');

            // * Verify the pick gave the field a row
            await expect(modalRow(page, fields.alpha)).toBeVisible();
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const postOnScreen = await channelsPage.centerView.getPostById(post.id);
            const chips = postOnScreen.container.getByTestId(CHIPS);
            const modal = page.locator(MODAL);

            // # Clear both attributes from the modal
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await expect(modal).toBeVisible();

            let write = waitForWrite(page, post.id);
            await modalClear(page, always).click();
            expect((await write).status()).toBe(200);

            write = waitForWrite(page, post.id);
            await modalClear(page, whenSet).click();
            expect((await write).status()).toBe(200);

            // * Verify the chips are gone and the one left is the one never touched
            await expect(chips.getByText('SECRET', {exact: true})).toHaveCount(0);
            await expect(chips.getByText('NOFORN', {exact: true})).toHaveCount(0);
            await expect(chips.getByText('ORCON', {exact: true})).toBeVisible();

            // # Close the modal and hover the chip row
            await page.keyboard.press('Escape');
            await expect(modal).toBeHidden();
            await chips.hover();

            // * Verify the card lists only the attribute that kept its value
            const card = page.getByTestId(CARD);
            await expect(card).toBeVisible();
            await expect(card.getByRole('listitem')).toHaveCount(1);
            await expect(card).toContainText('ORCON');
            await expect(card.getByText(always.name, {exact: true})).toHaveCount(0);
            await expect(card.getByText(whenSet.name, {exact: true})).toHaveCount(0);

            // # Reopen the modal
            await page.mouse.move(5, 5);
            await expect(card).toBeHidden();
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await expect(modal).toBeVisible();

            // * Verify the `always` field kept an empty row it can be filled in from, the
            // `when_set` one is gone, and the one with a value is still there
            await expect(modalRow(page, always)).toBeVisible();
            await expect(modalTrigger(page, always)).toHaveText('');
            await expect(modalRow(page, whenSet)).toHaveCount(0);
            await expect(modalRow(page, kept)).toBeVisible();
            await expect(modalTrigger(page, kept)).toHaveText('ORCON');

            // * Verify the picker offers the field that lost its row again
            await page.getByTestId('post-attributes-add').click();
            await expect(pickerItem(page, whenSet)).toBeVisible();
            await expect(pickerItem(page, always)).toHaveCount(0);
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await dropFieldUpdates(page);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const postOnScreen = await channelsPage.centerView.getPostById(post.id);
            const chip = postOnScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP);
            await expect(chip).toHaveText('Low');

            // # Open the modal, then take the permission away from members. The page is not told.
            await openModalFromPostMenu(channelsPage, postOnScreen);
            await expect(page.locator(MODAL)).toBeVisible();
            await expect(modalTrigger(page, level)).toHaveText('Low');
            await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, level.id, {permission_values: 'sysadmin'});

            // # Pick the other option
            const refused = page.waitForResponse(
                (response) =>
                    response.url().includes(`${VALUES_ROUTE}${post.id}`) && response.request().method() === 'PATCH',
            );
            await modalTrigger(page, level).click();
            await page.getByRole('menuitemradio', {name: 'High', exact: true}).click();

            // * Verify the server refused it, and the row says so
            expect((await refused).status()).toBe(403);
            await expect(page.getByTestId(`post-attribute-error-${level.name}`)).toHaveText(
                'You do not have permission to change this attribute',
            );

            // * Verify the chip on the post and the row both still hold the old value
            await expect(chip).toHaveText('Low');
            await expect(modalTrigger(page, level)).toHaveText('Low');
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);
