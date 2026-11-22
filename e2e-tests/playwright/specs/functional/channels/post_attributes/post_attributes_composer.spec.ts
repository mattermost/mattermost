// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';
import type {PropertyField} from '@mattermost/types/properties';

import {getAsset} from '@/asset';
import {Api, expect, postWith, settle, test, waitForApi} from '@mattermost/playwright-lib';

import {
    GROUP,
    OBJECT_TYPE,
    activeSystemFields,
    chooseOption,
    commitText,
    createField,
    deleteFields,
    dropFieldUpdates,
    fieldName,
    openThread,
    optionId,
    purgeFields,
    removeChip,
    sendMessage,
    setPostValues,
    stageField,
    tickOption,
    waitForCreatePost,
    sentValues,
    skipIfNoPostAttributesLicense,
} from './support';

/**
 * @objective Verify a select attribute can be picked, given a value and sent: the request
 * carries exactly that field and option, the chip is on the new post without a reload and
 * the composer has no chips left.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('picks, sets and sends a select attribute', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // # Provision a when_set select field
        const level = await createField(adminClient, fieldName('level', suffix), {
            options: ['Low', 'High'],
            visibility: 'when_set',
        });
        created.push(level);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;
        const chip = composer.postAttributes.chip(level);

        // # Pick the field from the `+`
        await stageField(composer, level);

        // * Verify its value menu opened by itself, and choose an option
        await expect(chip.attribute.valueMenu.option(optionId(level, 'High'))).toBeVisible();
        await chooseOption(composer, level, 'High');
        await expect(chip.attribute.valueButton).toContainText('High');

        // # Send, watching the request
        const message = `select ${suffix}`;
        const {values: sentFor} = await sendMessage(page, composer, message);

        // * Verify the request carries exactly this field and option, and nothing else
        expect(sentFor).toEqual([{field_id: level.id, value: optionId(level, 'High')}]);

        // * Verify the chip is on the new post and the composer has none left
        const sent = await postWith(app.center.postList, {text: message});
        await expect(sent.attributes.value.selectText).toHaveText('High');
        await expect(composer.postAttributes.container).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify every value control the composer offers can be filled in and sent, and
 * that each value reaches the sent post through its own renderer.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('fills in and sends every kind of value control', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // # Provision one field of each type, and two people for the user pickers
        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        const owner = await createField(adminClient, fieldName('owner', suffix), {type: 'user'});
        const colours = await createField(adminClient, fieldName('colours', suffix), {
            type: 'multiselect',
            options: ['Red', 'Green', 'Blue'],
        });
        const reviewers = await createField(adminClient, fieldName('reviewers', suffix), {type: 'multiuser'});
        const rank = await createField(adminClient, fieldName('rank', suffix), {
            type: 'rank',
            options: ['First', 'Second'],
        });
        created.push(note, owner, colours, reviewers, rank);

        const alice = await adminClient.createUser(await pw.random.user('alice'), '', '');
        const bob = await adminClient.createUser(await pw.random.user('bob'), '', '');
        await adminClient.addToTeam(team.id, alice.id);
        await adminClient.addToTeam(team.id, bob.id);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // Sends the staged chips with a message and returns what the request carried, and the post it made.
        const send = async (message: string) => {
            const {values: sentFor} = await sendMessage(page, composer, message);
            const post = await postWith(app.center.postList, {text: message});

            return {sentFor, post};
        };

        // # Text: picking focuses the input, Enter commits and it rests as a chip
        await stageField(composer, note);
        await expect(composer.postAttributes.chip(note).attribute.valueInputTextbox).toBeFocused();
        await commitText(composer, note, 'Q3 planning');

        // # Click the resting chip to reopen it
        await composer.postAttributes.chip(note).restButton.click();

        // * Verify the input is back with the committed value
        await expect(composer.postAttributes.chip(note).attribute.valueInputTextbox).toHaveValue('Q3 planning');

        let sent = await send(`text ${suffix}`);

        // * Verify the text value was sent and renders as a text chip on the post
        expect(sent.sentFor).toEqual([{field_id: note.id, value: 'Q3 planning'}]);
        await expect(sent.post.attributes.value.textText).toHaveText('Q3 planning');

        // # User: picking opens the picker; choose someone
        await stageField(composer, owner);
        const ownerPicker = composer.postAttributes.chip(owner).attribute.users;

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker is the shared react-select UserSelector, which gives its input and its options no test id; the input is found inside the generated group that wraps it
        const ownerInput = ownerPicker.locator.locator('input');
        await expect(ownerInput).toBeFocused();
        await ownerInput.fill(alice.username);

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
        await app.page.getByRole('option', {name: new RegExp(alice.username)}).click();

        // # Leave the picker, so the chip comes to rest
        await composer.message.container.focus();

        // * Verify the resting chip shows the person with an avatar
        const ownerChip = composer.postAttributes.chip(owner).value.user;
        await expect(ownerChip).toContainText(alice.username);

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the avatar is an image the chip draws with no test id of its own
        await expect(ownerChip.locator.locator('img')).toBeVisible();

        sent = await send(`user ${suffix}`);

        // * Verify the user id was sent and the post shows the user chip
        expect(sent.sentFor).toEqual([{field_id: owner.id, value: alice.id}]);
        await expect(sent.post.attributes.value.user).toContainText(alice.username);

        // # Multiselect: tick several options, which keeps the menu open
        await stageField(composer, colours);
        await tickOption(composer, colours, 'Red');
        await tickOption(composer, colours, 'Blue');
        await composer.postAttributes.chip(colours).attribute.valueButton.press('Escape');

        // * Verify one chip per ticked option in the staged chip
        await expect(composer.postAttributes.chip(colours).value.selectText).toHaveText(['Red', 'Blue']);

        sent = await send(`multi ${suffix}`);

        // * Verify both option ids were sent and the post has one chip per option
        expect(sent.sentFor).toEqual([
            {field_id: colours.id, value: [optionId(colours, 'Red'), optionId(colours, 'Blue')]},
        ]);
        await expect(sent.post.attributes.value.selectText).toHaveText(['Red', 'Blue']);

        // # Multiuser: pick two people
        await stageField(composer, reviewers);

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker is the shared react-select UserSelector, which gives its input and its options no test id; the input is found inside the generated group that wraps it
        const reviewersInput = composer.postAttributes.chip(reviewers).attribute.users.locator.locator('input');
        await reviewersInput.fill(alice.username);

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
        await app.page.getByRole('option', {name: new RegExp(alice.username)}).click();
        await reviewersInput.fill(bob.username);

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the user picker's options are react-select options with no test id; they are found by their ARIA role and the person's name
        await app.page.getByRole('option', {name: new RegExp(bob.username)}).click();
        await composer.message.container.focus();
        await expect(composer.postAttributes.chip(reviewers).restButton).toBeVisible();

        sent = await send(`multiuser ${suffix}`);

        // * Verify both ids were sent and the post has a user chip for each
        expect(sent.sentFor).toEqual([{field_id: reviewers.id, value: [alice.id, bob.id]}]);
        await expect(sent.post.attributes.value.user).toHaveCount(2);

        // # Rank: pick an option
        await stageField(composer, rank);
        await chooseOption(composer, rank, 'Second');

        sent = await send(`rank ${suffix}`);

        // * Verify the option id was sent and the post shows it
        expect(sent.sentFor).toEqual([{field_id: rank.id, value: optionId(rank, 'Second')}]);
        await expect(sent.post.attributes.value.selectText).toHaveText('Second');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the staged row is managed in the order the user picked: chips keep that
 * order before the inline add control, a staged value can be changed, a field whose menu is
 * closed without a value is un-staged and offered again, and a chip's tooltip is its field name.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('keeps staged chips in the order picked and lets them be changed', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // # Three text fields whose sort order is the reverse of the order they will be picked in
        const first = await createField(adminClient, fieldName('first', suffix), {type: 'text', sortOrder: 1});
        const second = await createField(adminClient, fieldName('second', suffix), {type: 'text', sortOrder: 2});
        const third = await createField(adminClient, fieldName('third', suffix), {type: 'text', sortOrder: 3});
        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(first, second, third, level);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;
        const row = composer.postAttributes;

        // # Pick them third, first, second
        await stageField(composer, third);
        await stageField(composer, first);
        await stageField(composer, second);

        // * Verify the chips are in the order picked, each before the inline add control
        await expect(row.chipList).toHaveKeys([third.id, first.id, second.id], {ordered: true});
        await expect(row.addButton).toBeVisible();

        const add = await row.addButton.locator.elementHandle();
        for (const field of [third, first, second]) {
            const before = await row
                .chip(field)
                .container.locator.evaluate(
                    (chip, addControl) =>
                        Boolean(
                            addControl && chip.compareDocumentPosition(addControl) & Node.DOCUMENT_POSITION_FOLLOWING,
                        ),
                    add,
                );
            expect(before, `${field.name} should come before the inline add control`).toBe(true);
        }

        // # Remove the three text chips, and stage a select field to change its value
        for (const field of [third, first, second]) {
            await removeChip(composer, field);
        }
        await stageField(composer, level);
        await chooseOption(composer, level, 'Low');

        const trigger = row.chip(level).attribute.valueButton;
        await expect(trigger).toContainText('Low');

        // # Reopen the staged value's menu and pick another
        await trigger.clickTo(row.chip(level).attribute.valueMenu);
        await chooseOption(composer, level, 'High');

        // * Verify the chip shows the new value
        await expect(trigger).toContainText('High');
        await expect(trigger).not.toContainText('Low');

        // # Hover the chip
        await trigger.hover();

        // * Verify the field's name is its tooltip
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the tooltip comes from the shared WithTooltip, which takes no test id and renders outside the composer; it is read by its ARIA role
        await expect(app.page.getByRole('tooltip')).toContainText(level.name);

        // # Remove it, then pick the field again and close its menu with Escape without choosing
        await removeChip(composer, level);
        await stageField(composer, level);
        await expect(row.chip(level).attribute.valueMenu.option(optionId(level, 'Low'))).toBeVisible();
        await row.chip(level).attribute.valueButton.press('Escape');

        // * Verify the chip went away and the field is offered again
        await expect(row.chip(level).container).toHaveCount(0);
        await composer.postAttributesButton.addButton.clickTo(composer.postAttributesButton.addMenu);
        await expect(composer.postAttributesButton.addMenu.field(level)).toBeVisible();
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the × on a staged chip, by pointer and by keyboard, removes the chip and
 * offers its field again (an always-visible field included), and that a removed value is not sent.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('removes a staged chip and does not send its value', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const kept = await createField(adminClient, fieldName('kept', suffix), {type: 'text'});
        const dropped = await createField(adminClient, fieldName('dropped', suffix), {type: 'text'});
        const always = await createField(adminClient, fieldName('always', suffix), {
            options: ['Yes', 'No'],
            visibility: 'always',
        });
        created.push(kept, dropped, always);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;
        const picker = composer.postAttributesButton;

        // # Stage an always-visible field with a value and remove it with the pointer
        await stageField(composer, always);
        await chooseOption(composer, always, 'Yes');
        await removeChip(composer, always);

        // * Verify the chip is gone and the field is offered again
        await picker.addButton.clickTo(picker.addMenu);
        await expect(picker.addMenu.field(always)).toBeVisible();
        // Three fields: the picker has no search box below five, so Escape goes to the page, as in master
        await page.keyboard.press('Escape');
        await expect(picker.addMenu.container).toBeHidden();

        // # Stage two text fields with values
        await stageField(composer, kept);
        await commitText(composer, kept, 'keep me');
        await stageField(composer, dropped);

        const droppedChip = composer.postAttributes.chip(dropped);
        await droppedChip.attribute.valueInputTextbox.fill('drop me');

        // # Tab from the input to its chip's × and press Enter
        await droppedChip.attribute.valueInputTextbox.press('Tab');
        await expect(droppedChip.removeButton).toBeFocused();
        await droppedChip.removeButton.press('Enter');

        // * Verify the chip is gone and its field is offered again
        await expect(droppedChip.container).toHaveCount(0);
        await picker.addButton.clickTo(picker.addMenu);
        await expect(picker.addMenu.field(dropped)).toBeVisible();
        await picker.addMenu.container.press('Escape');
        await expect(picker.addMenu.container).toBeHidden();

        // # Send
        const {values: sentFor} = await sendMessage(page, composer, `removed ${suffix}`);

        // * Verify only the kept value is in the request
        expect(sentFor).toEqual([{field_id: kept.id, value: 'keep me'}]);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the picker offers only the fields the user can set, searches once there
 * are five or more, and leaves always-visible fields unstaged until picked.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'offers only the fields the user may set, with a search box from five',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            // # Fields a member may set, may not, and nobody may; five settable ones put the
            // picker over its search threshold wherever other fields exist
            const alpha = await createField(adminClient, fieldName('alpha', suffix), {type: 'text'});
            const beta = await createField(adminClient, fieldName('beta', suffix), {type: 'text'});
            const gamma = await createField(adminClient, fieldName('gamma', suffix), {type: 'text'});
            const delta = await createField(adminClient, fieldName('delta', suffix), {type: 'text'});
            const always = await createField(adminClient, fieldName('always', suffix), {
                options: ['Yes'],
                visibility: 'always',
            });
            const adminsOnly = await createField(adminClient, fieldName('adminsonly', suffix), {
                type: 'text',
                permissionValues: 'sysadmin',
            });
            const nobody = await createField(adminClient, fieldName('nobody', suffix), {
                type: 'text',
                permissionValues: 'none',
            });
            created.push(alpha, beta, gamma, delta, always, adminsOnly, nobody);

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const composer = app.center.postCreate;
            const picker = composer.postAttributesButton;

            // * Verify nothing is staged on its own, the always-visible field included
            await expect(composer.postAttributes.container).toHaveCount(0);

            // # Open the picker
            await picker.addButton.clickTo(picker.addMenu);

            // * Verify the settable fields are offered, the always-visible one among them, and the
            // fields a member may not set, and the one nobody may, are not
            for (const field of [alpha, beta, gamma, delta, always]) {
                await expect(picker.addMenu.field(field)).toBeVisible();
            }
            await expect(picker.addMenu.field(adminsOnly)).toHaveCount(0);
            await expect(picker.addMenu.field(nobody)).toHaveCount(0);

            // * Verify the search box has focus
            const search = picker.addMenu.searchTextbox;
            await expect(search).toBeFocused();

            // # Search by name, in capitals to show the match ignores case
            await search.fill(`ALPHA_${suffix}`.toUpperCase());

            // * Verify only the matching field is left
            await expect(picker.addMenu.field(alpha)).toBeVisible();
            await expect(picker.addMenu.field(beta)).toHaveCount(0);

            // # Search for something every one of the suite's fields matches, then press ArrowDown
            await search.fill(`_${suffix}`);
            await expect(picker.addMenu.field(beta)).toBeVisible();

            // The first item is whichever the list draws first, so it is read from the list
            const [firstOffered] = await picker.addMenu.fieldList.keys();
            await search.press('ArrowDown');

            // * Verify focus moved into the list
            await expect(picker.addMenu.field(firstOffered)).toBeFocused();
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

test.describe('in mobile view', () => {
    // Narrow enough for mobile view, where the picker opens as a modal rather than a
    // popover
    test.use({viewport: {width: 400, height: 1024}});

    /**
     * @objective Verify the picker's search works in mobile view: the box shows what is
     * typed, the list follows it, a filtered field can be picked, and the next opening
     * starts from an empty search.
     *
     * @precondition The PostAttributes feature flag is enabled.
     */
    test('searches the field picker in mobile view', {tag: '@post_attributes'}, async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            // # Six settable fields, so the picker keeps its search box with one staged
            const alpha = await createField(adminClient, fieldName('alpha', suffix), {type: 'text'});
            const beta = await createField(adminClient, fieldName('beta', suffix), {type: 'text'});
            const gamma = await createField(adminClient, fieldName('gamma', suffix), {type: 'text'});
            const delta = await createField(adminClient, fieldName('delta', suffix), {type: 'text'});
            const epsilon = await createField(adminClient, fieldName('epsilon', suffix), {type: 'text'});
            const zeta = await createField(adminClient, fieldName('zeta', suffix), {type: 'text'});
            created.push(alpha, beta, gamma, delta, epsilon, zeta);

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const composer = app.center.postCreate;
            const picker = composer.postAttributesButton;
            const search = picker.addMenu.searchTextbox;

            // # Open the picker
            await picker.addButton.click();
            await expect(search).toBeVisible();

            // # Tap the search box and type one field's name, key by key as a user would: the
            // modal's list must neither close on the tap nor take the letters
            await search.locator.click();
            await search.type(`alpha_${suffix}`);

            // * Verify the box shows the search and only the matching field is left
            await expect(search).toHaveValue(`alpha_${suffix}`);
            await expect(picker.addMenu.field(alpha)).toBeVisible();
            for (const field of [beta, gamma, delta, epsilon, zeta]) {
                await expect(picker.addMenu.field(field)).toHaveCount(0);
            }

            // # Search for something no field matches
            await search.fill(`nothing_${suffix}`);

            // * Verify the list says so
            await expect(picker.addMenu.noResultsMenuItem).toBeVisible();

            // # Search again and pick the field the search found
            await search.fill(`gamma_${suffix}`);
            await picker.addMenu.field(gamma).clickTo(composer.postAttributes.chip(gamma));

            // # Open the picker again
            await picker.addButton.click();

            // * Verify the search starts empty, with every field not yet staged offered
            await expect(search).toHaveValue('');
            for (const field of [alpha, beta, delta, epsilon, zeta]) {
                await expect(picker.addMenu.field(field)).toBeVisible();
            }
        } finally {
            await deleteFields(adminClient, created);
        }
    });
});

/**
 * @objective Verify neither add control is shown once every settable field is staged.
 *
 * @precondition The PostAttributes feature flag is enabled, and no other system-scoped
 * post attribute field exists on the server: a field this spec did not create would
 * stay unstaged, so the case can only be proven on a clean server.
 */
test('hides both add controls when every settable field is staged', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const others = await activeSystemFields(adminClient);
        test.skip(others.length > 0, `${others.length} other post attribute fields exist on the server`);

        const one = await createField(adminClient, fieldName('one', suffix), {type: 'text'});
        const two = await createField(adminClient, fieldName('two', suffix), {type: 'text'});
        created.push(one, two);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // # Stage the first field: one is still left to offer
        await stageField(composer, one);

        // * Verify both add controls are there
        await expect(composer.postAttributesButton.addButton).toBeVisible();
        await expect(composer.postAttributes.addButton).toBeVisible();

        // # Stage the second, which is the last
        await stageField(composer, two);

        // * Verify neither add control is shown
        await expect(composer.postAttributes.chip(two).container).toBeVisible();
        await expect(composer.postAttributesButton.addButton).toHaveCount(0);
        await expect(composer.postAttributes.addButton).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify staged values are discarded on a channel or thread switch, and that the
 * centre and thread composers stage independently.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'drops staged values on a channel or thread switch and keeps composers apart',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            // # Keep replies in the centre, so threads are opened from there
            await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

            const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
            const other = await createField(adminClient, fieldName('other', suffix), {type: 'text'});
            created.push(note, other);

            const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
            const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
            const firstRoot = await userClient.createTestPost({
                channel_id: townSquare.id,
                message: `first root ${suffix}`,
            });
            const secondRoot = await userClient.createTestPost({
                channel_id: townSquare.id,
                message: `second root ${suffix}`,
            });

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});

            const centre = app.center.postCreate;
            const thread = app.rhs.postCreate;

            // # Stage a value in the centre, then change channel and come back
            await stageField(centre, note);
            await commitText(centre, note, 'staged');
            await app.lhs.channelList.channel(offTopic).container.clickTo(app.channelsPage, {team, channel: offTopic});

            // * Verify the composer is empty in the other channel
            await expect(app.center.postCreate.postAttributes.container).toHaveCount(0);

            await app.lhs.channelList
                .channel(townSquare)
                .container.clickTo(app.channelsPage, {team, channel: townSquare});

            // * Verify it is still empty when back
            await expect(centre.postAttributes.container).toHaveCount(0);

            // # Open the first thread and stage a value in its composer
            await openThread(app, firstRoot);
            await stageField(thread, note);
            await commitText(thread, note, 'in thread');

            // * Verify the centre composer is left alone
            await expect(thread.postAttributes.chip(note).container).toBeVisible();
            await expect(centre.postAttributes.container).toHaveCount(0);

            // # Stage in the centre too
            await stageField(centre, other);

            // * Verify the thread composer still holds only its own
            await expect(centre.postAttributes.chip(other).container).toBeVisible();
            await expect(thread.postAttributes.chip(other).container).toHaveCount(0);
            await expect(thread.postAttributes.chip(note).container).toBeVisible();

            // # Open the second thread
            await openThread(app, secondRoot);

            // * Verify the thread composer is empty, and the centre one kept its chip
            await expect(thread.postAttributes.container).toHaveCount(0);
            await expect(centre.postAttributes.chip(other).container).toBeVisible();
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify a reply composed in the thread sidebar carries its staged values, and
 * its chips render in the sidebar and in the centre column.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('sends a reply with attributes', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // # Keep replies in the centre
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const root = await userClient.createTestPost({channel_id: townSquare.id, message: `root ${suffix}`});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the thread, stage a value in its composer and send a reply
        await openThread(app, root);

        const reply = app.rhs.postCreate;
        await stageField(reply, note);
        await commitText(reply, note, 'on the reply');

        await reply.message.container.fill(`reply ${suffix}`);
        const request = waitForCreatePost(page);
        await settle(reply.sendButton, {wait: Api.CreatePost}).click();

        // * Verify the values rode on the reply, which is part of the root's thread
        const sentRequest = await request;
        expect(sentRequest.postDataJSON().root_id).toBe(root.id);
        expect(sentValues(sentRequest)).toEqual([{field_id: note.id, value: 'on the reply'}]);

        // * Verify the chip renders in the thread sidebar and in the centre column
        const inSidebar = await postWith(app.rhs.thread, {text: `reply ${suffix}`});
        await expect(inSidebar.attributes.value.textText).toHaveText('on the reply');

        const inCentre = await postWith(app.center.postList, {text: `reply ${suffix}`});
        await expect(inCentre.attributes.value.textText).toHaveText('on the reply');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify an emoji reaction sent with values staged reacts to the last post,
 * creates no post, and leaves the staged chips in place.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('keeps staged values when a message becomes a reaction', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(level);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const last = await userClient.createTestPost({channel_id: townSquare.id, message: `last ${suffix}`});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        const composer = app.center.postCreate;

        // # Stage a value
        await stageField(composer, level);
        await chooseOption(composer, level, 'High');

        // # Send `+:smile:`, watching for posts and for the reaction
        const createdPosts: string[] = [];
        page.on('request', (request) => {
            if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v4/posts')) {
                createdPosts.push(request.url());
            }
        });
        await composer.message.container.fill('+:smile:');
        await settle(composer.sendButton, {wait: Api.SaveReaction}).click();

        // * Verify the reaction landed on the last post and no post was created
        const reacted = await adminClient.getPost(last.id);
        expect(reacted.metadata.reactions?.map((r) => r.emoji_name)).toEqual(['smile']);
        expect(createdPosts).toEqual([]);

        // * Verify the staged chip is still there, with its value
        await expect(composer.postAttributes.chip(level).attribute.valueButton).toContainText('High');
        await expect(composer.message.container).toHaveValue('');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify running a slash command with values staged keeps them, and that the next
 * message sent carries them and clears the chips.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('keeps staged values through a slash command', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(level);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // # Stage a value and run `/echo hi`
        await stageField(composer, level);
        await chooseOption(composer, level, 'High');

        await composer.message.container.fill('/echo hi');
        await settle(composer.message.container, {wait: Api.ExecuteCommand}).press('Enter');

        // * Verify the command ran, the box is empty and the value is still staged
        await expect(composer.message.container).toHaveValue('');
        await expect(composer.postAttributes.chip(level).attribute.valueButton).toContainText('High');

        // # Send a message
        const {values: sentFor} = await sendMessage(page, composer, `after command ${suffix}`);

        // * Verify it carries the value and the chips are cleared
        expect(sentFor).toEqual([{field_id: level.id, value: optionId(level, 'High')}]);
        await expect(composer.postAttributes.container).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify scheduling is blocked, with its reason on show, while a value is staged:
 * the chevron is disabled, Send still works, and removing the last value enables it again.
 *
 * @precondition The PostAttributes feature flag is enabled and scheduled posts are on.
 */
test('blocks scheduling while a value is staged', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {ScheduledPosts: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;
        const chevron = composer.sendOptions.openMenuButton;

        // # Write a message, so the chevron is enabled for reasons that have nothing to do with values
        await composer.message.container.fill(`schedule ${suffix}`);
        await expect(chevron).toBeEnabled();

        // # Stage a value
        await stageField(composer, note);
        await commitText(composer, note, 'staged');

        // * Verify the chevron is disabled
        await expect(chevron).toBeDisabled();

        // # Hover what wraps it
        await composer.sendOptions.blockedGroup.hover();

        // * Verify the tooltip says why
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the tooltip comes from the shared WithTooltip, which takes no test id and renders outside the composer; it is read by its ARIA role
        await expect(app.page.getByRole('tooltip')).toContainText(/Messages with attributes can.t be scheduled/);

        // # Remove the only value
        await removeChip(composer, note);

        // * Verify scheduling is available again
        await expect(chevron).toBeEnabled();

        // # Stage a value again and send
        await stageField(composer, note);
        await commitText(composer, note, 'sent');
        await expect(chevron).toBeDisabled();

        const request = waitForCreatePost(page);
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();

        // * Verify Send still works, and carries the value
        expect(sentValues(await request)).toEqual([{field_id: note.id, value: 'sent'}]);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify attributes and burn-on-read keep apart: a staged value disables the
 * burn-on-read button with its reason, burn-on-read disables adding attributes with its reason,
 * and the API refuses a burn-on-read post that carries values.
 *
 * @precondition The PostAttributes feature flag is enabled, and the server's licence offers
 * burn-on-read: Enterprise Advanced, or Entry, which the webapp ranks alongside it.
 */
test('keeps burn-on-read and attributes apart', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    await skipIfNoPostAttributesLicense();

    const license = await adminClient.getClientLicenseOld();
    test.skip(
        !['advanced', 'entry'].includes(license.SkuShortName),
        'burn-on-read needs an Enterprise Advanced or Entry licence',
    );

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // * Verify burn-on-read is available while nothing is staged
        await expect(composer.burnOnReadButton).toBeEnabled();

        // # Stage a value
        await stageField(composer, note);
        await commitText(composer, note, 'staged');

        // * Verify burn-on-read is disabled, and its tooltip says why
        await expect(composer.burnOnReadButton).toBeDisabled();
        await composer.burnOnReadBlockedGroup.hover();

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the tooltip comes from the shared WithTooltip, which takes no test id and renders outside the composer; it is read by its ARIA role
        await expect(app.page.getByRole('tooltip')).toContainText(/Messages with attributes can.t be burn-on-read/);

        // # Remove the chip
        await removeChip(composer, note);

        // * Verify burn-on-read is enabled again
        await expect(composer.burnOnReadButton).toBeEnabled();

        // # Turn burn-on-read on
        await composer.burnOnReadButton.click();
        await expect(composer.burnOnReadLabel).toBeVisible();

        // * Verify the `+` is disabled with its reason, and no inline add control exists to
        // outlive it, since no chip can be staged
        await expect(composer.postAttributesButton.addButton).toBeDisabled();
        await composer.postAttributesButton.addBlockedGroup.hover();

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the tooltip comes from the shared WithTooltip, which takes no test id and renders outside the composer; it is read by its ARIA role
        await expect(app.page.getByRole('tooltip')).toContainText(/Burn-on-read messages can.t have attributes/);
        await expect(composer.postAttributes.addButton).toHaveCount(0);

        // # Turn it off
        await composer.burnOnReadButton.click();
        await expect(composer.burnOnReadLabel).toHaveCount(0);

        // * Verify the `+` is enabled again
        await expect(composer.postAttributesButton.addButton).toBeEnabled();

        // # Ask the API for a burn-on-read post with values
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const refused = await userClient
            .createPost({
                channel_id: townSquare.id,
                message: `burn ${suffix}`,
                type: 'burn_on_read',
                metadata: {property_values: [{field_id: note.id, value: 'x'}]},
            } as Parameters<typeof userClient.createPost>[0])
            .then(
                () => undefined,
                (error: {status_code?: number; server_error_id?: string}) => error,
            );

        // * Verify it is refused as a bad request, for that reason
        expect(refused?.status_code).toBe(400);
        expect(refused?.server_error_id).toBe('api.post.create_post.attributes_burn_on_read.app_error');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify staged values never reach drafts: the message comes back after a reload
 * and after a channel switch, and no attribute does.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('restores the message from a draft but not the staged values', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        const composer = app.center.postCreate;
        const message = `draft ${suffix}`;

        // # Type a message and stage a value
        await composer.message.container.fill(message);
        await expect(composer.message.container).toHaveValue(message);
        await stageField(composer, note);
        await commitText(composer, note, 'staged');

        // # Reload
        await page.reload();
        await expect(composer.message.container).toBeVisible();

        // * Verify the message came back and no attribute did
        await expect(composer.message.container).toHaveValue(message);
        await expect(composer.postAttributes.container).toHaveCount(0);

        // # Stage again, then change channel and come back
        await stageField(composer, note);
        await commitText(composer, note, 'staged again');
        await app.lhs.channelList.channel(offTopic).container.clickTo(app.channelsPage, {team, channel: offTopic});
        await app.lhs.channelList.channel(townSquare).container.clickTo(app.channelsPage, {team, channel: townSquare});

        // * Verify the same
        await expect(composer.message.container).toHaveValue(message);
        await expect(composer.postAttributes.container).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify staged values travel with the composer's other features: a file
 * attachment, and a message priority label.
 *
 * @precondition The PostAttributes feature flag is enabled and message priority is on.
 */
test('sends values together with a file and a priority label', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {PostPriority: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // # Attach a file and stage a value
        await composer.message.container.fill(`with file ${suffix}`);
        await settle(composer.uploadInput, {wait: Api.UploadFile}).chooseFiles(getAsset('small-image.png'));
        await expect(composer.filePreviews.fileList).toHaveKeyCount(1);
        await stageField(composer, note);
        await commitText(composer, note, 'with a file');

        let request = waitForCreatePost(page);
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();

        // * Verify both arrived
        let sentRequest = await request;
        expect(sentRequest.postDataJSON().file_ids).toHaveLength(1);
        expect(sentValues(sentRequest)).toEqual([{field_id: note.id, value: 'with a file'}]);

        const withFile = await postWith(app.center.postList, {text: `with file ${suffix}`});
        await expect(withFile.attributes.value.textText).toHaveText('with a file');
        // A PNG draws as an image, not as a file card
        await expect(withFile.attachments.imageList).toHaveKeyCount(1);

        // # Set a priority and stage a value
        await composer.message.container.fill(`with priority ${suffix}`);

        const {menu, openButton} = app.postPriorityPicker;
        await openButton.click();
        await expect(menu.priority('standard')).toBeVisible();
        await menu.priority('important').click();
        await expect(menu.priority('important')).toHaveAttribute('aria-checked', 'true');
        await menu.applyButton.click();
        await expect(menu.priority('standard')).toBeHidden();
        await stageField(composer, note);
        await commitText(composer, note, 'with a label');

        request = waitForCreatePost(page);
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();

        // * Verify both arrived
        sentRequest = await request;
        expect(sentRequest.postDataJSON().metadata.priority.priority).toBe('important');
        expect(sentValues(sentRequest)).toEqual([{field_id: note.id, value: 'with a label'}]);

        const withPriority = await postWith(app.center.postList, {text: `with priority ${suffix}`});
        await expect(withPriority.priorityLabel).toHaveText(/important/i);
        await expect(withPriority.attributes.value.textText).toHaveText('with a label');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a direct and a group message offer system-scoped fields and send values.
 * Post fields are system-scoped only, so a conversation has no field of its own.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('applies system fields in direct and group messages', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const alice = await adminClient.createUser(await pw.random.user('alice'), '', '');
        const bob = await adminClient.createUser(await pw.random.user('bob'), '', '');
        await adminClient.createDirectChannel([user.id, alice.id]);
        const gm = await adminClient.createGroupChannel([user.id, alice.id, bob.id]);

        // # A select field and a text field, both system-scoped
        const everywhere = await createField(adminClient, fieldName('everywhere', suffix), {
            options: ['Low', 'High'],
        });
        created.push(everywhere);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {app, page} = await pw.testBrowser.login(user);

        const conversations = [
            {label: 'dm', channel: `@${alice.username}`},
            {label: 'gm', channel: gm.name},
        ];

        for (const {label, channel} of conversations) {
            // # Open the conversation
            await app.channelsPage.goto({team, path: 'messages', channel});

            const composer = app.center.postCreate;
            const picker = composer.postAttributesButton;

            // * Verify both system fields are offered
            await picker.addButton.clickTo(picker.addMenu);
            await expect(picker.addMenu.field(everywhere)).toBeVisible();
            await expect(picker.addMenu.field(note)).toBeVisible();
            await picker.addMenu.container.press('Escape');
            await expect(picker.addMenu.container).toBeHidden();

            // # Stage one of each and send
            await stageField(composer, everywhere);
            await chooseOption(composer, everywhere, 'High');
            await stageField(composer, note);
            await commitText(composer, note, `in the ${label}`);

            const message = `${label} ${suffix}`;
            const {values: sentFor} = await sendMessage(page, composer, message);

            // * Verify both values were sent and are on the post
            expect(sentFor).toEqual(
                expect.arrayContaining([
                    {field_id: everywhere.id, value: optionId(everywhere, 'High')},
                    {field_id: note.id, value: `in the ${label}`},
                ]),
            );
            const sent = await postWith(app.center.postList, {text: message});
            await expect(sent.attributes.value.selectText).toHaveText('High');
            await expect(sent.attributes.value.textText).toHaveText(`in the ${label}`);
        }
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify editing a sent post's message, in the composer's edit mode, shows no
 * attribute chips or add control and leaves the post's values as they were.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('edits a message without touching its attributes', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(level);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: townSquare.id, message: `original ${suffix}`});
        await setPostValues(adminClient, post.id, [{field_id: level.id, value: optionId(level, 'High')}]);

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        const onScreen = app.center.postList.post(post);
        await expect(onScreen.attributes.value.selectText).toHaveText('High');

        // # Open the post for editing from the empty composer
        const editor = app.postEdit.editor;
        await app.center.postCreate.message.container.pressTo('ArrowUp', editor.message.container);

        // * Verify the edit box has no chips and no add control
        await expect(editor.postAttributes.container).toHaveCount(0);
        await expect(editor.postAttributes.addButton).toHaveCount(0);

        // # Change the message and save
        await editor.message.container.fill(`edited ${suffix}`);
        await settle(editor.saveButton, {wait: Api.PatchPost}).click();

        // * Verify the post kept its chip
        await expect(onScreen.message.container).toContainText(`edited ${suffix}`);
        await expect(onScreen.attributes.value.selectText).toHaveText('High');

        // # Reload, so what is shown is what the server stored
        await page.reload();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // * Verify the value is unchanged
        const reloaded = app.center.postList.post(post);
        await expect(reloaded.message.container).toContainText(`edited ${suffix}`);
        await expect(reloaded.attributes.value.selectText).toHaveText('High');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a send the server refuses keeps its values on the failed post: the
 * composer is already empty when the refusal lands, Retry sends the same values again, Cancel
 * removes the post, and once the server accepts, Retry puts the chip on the post.
 *
 * The refusal is the server's own 403 `api.post.create_post.attribute_no_permission`. The
 * field is linked to a template, so its `permission_values` can be patched between `member`
 * and `sysadmin`: tightened to `sysadmin` after the user staged a value, loosened back to
 * `member` before the last Retry.
 *
 * The page does not get the field's `property_field_updated` websocket event, which
 * `dropFieldUpdates` filters out on the page's own socket. With it the composer would see the
 * field become unsettable, drop its chip and stop sending its value, so the post would go
 * through without the value and nothing would be refused. The filter is on the browser's
 * socket rather than the patch going through a second client, because the update is
 * broadcast to every session of the user and has to be kept from this page specifically;
 * the server still enforces the tightened permission, which is what is asserted.
 *
 * @precondition The PostAttributes feature flag is enabled, and the server has an
 * Enterprise-level licence (Entry counts).
 */
test('keeps the values on a post whose send was refused', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        // A member may set it when the user stages the value; the level is tightened later
        const level = await createField(adminClient, fieldName('level', suffix), {
            options: ['Low', 'High'],
            permissionValues: 'member',
        });
        created.push(level);
        const expected = [{field_id: level.id, value: optionId(level, 'High')}];

        const {app, page} = await pw.testBrowser.login(user);
        await dropFieldUpdates(page);
        await app.channelsPage.goto({team, channel: 'town-square'});

        const composer = app.center.postCreate;

        // * Verify a refusal is the server's own, with its error id
        const expectRefused = (body: unknown) =>
            expect((body as {id?: string}).id).toBe('api.post.create_post.attribute_no_permission.app_error');

        // # Stage the value, then take the permission away from members. The page is not told.
        await stageField(composer, level);
        await chooseOption(composer, level, 'High');
        await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, level.id, {permission_values: 'sysadmin'});

        // # Send
        const refusedMessage = `refused ${suffix}`;
        await composer.message.container.fill(refusedMessage);
        const first = waitForCreatePost(page);
        const firstAnswer = await settle(composer.sendButton, {wait: Api.CreatePost, status: 403}).click();

        // * Verify the values were sent and the server refused them
        expect(sentValues(await first)).toEqual(expected);
        expectRefused(firstAnswer);

        // * Verify the composer is empty, like the message, and the post shows as failed
        await expect(composer.postAttributes.container).toHaveCount(0);
        await expect(composer.message.container).toHaveValue('');
        const failed = await postWith(app.center.postList, {text: refusedMessage});

        const retry = failed.failed.retryLink;
        await expect(retry).toBeVisible();

        // # Retry
        let again = waitForCreatePost(page);
        const [secondAnswer] = await Promise.all([waitForApi(page, Api.CreatePost, {status: 403}), retry.click()]);

        // * Verify the same values are sent again, and refused the same way
        expect(sentValues(await again)).toEqual(expected);
        expectRefused(secondAnswer);
        await expect(retry).toBeVisible();

        // # Let members set it again, and Retry
        await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, level.id, {permission_values: 'member'});
        again = waitForCreatePost(page);
        await Promise.all([waitForApi(page, Api.CreatePost, {status: 201}), retry.click()]);

        // * Verify the values are sent a third time, accepted, and the chip is on the post. The
        // accepted post has the server's id, so it is found again by its message
        expect(sentValues(await again)).toEqual(expected);
        const accepted = await postWith(app.center.postList, {text: refusedMessage});
        await expect(accepted.attributes.value.selectText).toHaveText('High');

        // # Take the permission away again, send a second post and cancel it
        await stageField(composer, level);
        await chooseOption(composer, level, 'High');
        await adminClient.patchPropertyField(GROUP, OBJECT_TYPE, level.id, {permission_values: 'sysadmin'});

        const cancelledMessage = `cancelled ${suffix}`;
        await composer.message.container.fill(cancelledMessage);
        await settle(composer.sendButton, {wait: Api.CreatePost, status: 403}).click();

        const cancelled = await postWith(app.center.postList, {text: cancelledMessage});

        const cancel = cancelled.failed.cancelLink;
        await expect(cancel).toBeVisible();
        await cancel.click();

        // * Verify the post is gone
        await expect(cancelled.container).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});
