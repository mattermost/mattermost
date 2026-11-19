// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {CollapsedThreads} from '@mattermost/types/config';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    activeSystemFields,
    chooseOption,
    composerChip,
    composerChips,
    composerInlineAdd,
    composerInput,
    composerPlus,
    composerRemove,
    composerRest,
    composerTrigger,
    createField,
    deleteFields,
    fieldName,
    optionId,
    pickerItem,
    purgeFields,
    sentValues,
    setPostValues,
    stageField,
    waitForCreatePost,
} from './support';

const CHIPS = 'post-attributes-chips';
const OPTION_CHIP = 'select-property';
const TEXT_CHIP = 'text-property';
const USER_CHIP = 'user-property';

// A post in the centre column, found by its message so a reply or an unrelated post
// never matches.
function postWithMessage(scope: Locator, message: string) {
    return scope.getByTestId('postView').filter({hasText: message});
}

/**
 * @objective Verify a select attribute can be picked, given a value and sent: the request
 * carries exactly that field and option, the chip is on the new post without a reload and
 * the composer has no chips left.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('picks, sets and sends a select attribute', {tag: '@post_attributes'}, async ({pw}) => {
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;

        // # Pick the field from the `+`
        await stageField(page, composer.container, level);

        // * Verify its value menu opened by itself, and choose an option
        await expect(page.getByRole('menuitemradio', {name: 'High', exact: true})).toBeVisible();
        await chooseOption(page, 'High');
        await expect(composerTrigger(composer.container, level)).toContainText('High');

        // # Send, watching the request
        const message = `select ${suffix}`;
        await composer.writeMessage(message);
        const request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify the request carries exactly this field and option, and nothing else
        expect(sentValues(await request)).toEqual([{field_id: level.id, value: optionId(level, 'High')}]);

        // * Verify the chip is on the new post and the composer has none left
        const sent = postWithMessage(channelsPage.centerView.container, message);
        await expect(sent.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('High');
        await expect(composerChips(composer.container)).toHaveCount(0);
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;
        const centre = channelsPage.centerView.container;

        // Sends the staged chips with a message and returns what the request carried.
        const send = async (message: string) => {
            await composer.writeMessage(message);
            const request = waitForCreatePost(page);
            await composer.sendMessage();
            return sentValues(await request);
        };

        // # Text: picking focuses the input, Enter commits and it rests as a chip
        await stageField(page, scope, note);
        await expect(composerInput(scope, note)).toBeFocused();
        await composerInput(scope, note).fill('Q3 planning');
        await composerInput(scope, note).press('Enter');
        await expect(composerRest(scope, note).getByTestId(TEXT_CHIP)).toHaveText('Q3 planning');

        // # Click the resting chip to reopen it
        await composerRest(scope, note).click();

        // * Verify the input is back with the committed value
        await expect(composerInput(scope, note)).toHaveValue('Q3 planning');

        let sentFor = await send(`text ${suffix}`);

        // * Verify the text value was sent and renders as a text chip on the post
        expect(sentFor).toEqual([{field_id: note.id, value: 'Q3 planning'}]);
        await expect(postWithMessage(centre, `text ${suffix}`).getByTestId(CHIPS).getByTestId(TEXT_CHIP)).toHaveText(
            'Q3 planning',
        );

        // # User: picking opens the picker; choose someone
        await stageField(page, scope, owner);
        await expect(composerChip(scope, owner).locator('input')).toBeFocused();
        await composerChip(scope, owner).locator('input').fill(alice.username);
        await page.getByRole('option', {name: new RegExp(alice.username)}).click();

        // # Leave the picker, so the chip comes to rest
        await composer.input.click();

        // * Verify the resting chip shows the person with an avatar
        const ownerChip = composerRest(scope, owner).getByTestId(USER_CHIP);
        await expect(ownerChip).toContainText(alice.username);
        await expect(ownerChip.locator('img')).toBeVisible();

        sentFor = await send(`user ${suffix}`);

        // * Verify the user id was sent and the post shows the user chip
        expect(sentFor).toEqual([{field_id: owner.id, value: alice.id}]);
        await expect(postWithMessage(centre, `user ${suffix}`).getByTestId(CHIPS).getByTestId(USER_CHIP)).toContainText(
            alice.username,
        );

        // # Multiselect: tick several options, which keeps the menu open
        await stageField(page, scope, colours);
        await chooseOption(page, 'Red', {multi: true});
        await chooseOption(page, 'Blue', {multi: true});
        await page.keyboard.press('Escape');

        // * Verify one chip per ticked option in the staged chip
        await expect(composerTrigger(scope, colours).getByTestId(OPTION_CHIP)).toHaveText(['Red', 'Blue']);

        sentFor = await send(`multi ${suffix}`);

        // * Verify both option ids were sent and the post has one chip per option
        expect(sentFor).toEqual([{field_id: colours.id, value: [optionId(colours, 'Red'), optionId(colours, 'Blue')]}]);
        await expect(postWithMessage(centre, `multi ${suffix}`).getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText(
            ['Red', 'Blue'],
        );

        // # Multiuser: pick two people
        await stageField(page, scope, reviewers);
        const reviewersInput = composerChip(scope, reviewers).locator('input');
        await reviewersInput.fill(alice.username);
        await page.getByRole('option', {name: new RegExp(alice.username)}).click();
        await reviewersInput.fill(bob.username);
        await page.getByRole('option', {name: new RegExp(bob.username)}).click();
        await composer.input.click();

        sentFor = await send(`multiuser ${suffix}`);

        // * Verify both ids were sent and the post has a user chip for each
        expect(sentFor).toEqual([{field_id: reviewers.id, value: [alice.id, bob.id]}]);
        await expect(
            postWithMessage(centre, `multiuser ${suffix}`).getByTestId(CHIPS).getByTestId(USER_CHIP),
        ).toHaveCount(2);

        // # Rank: pick an option
        await stageField(page, scope, rank);
        await chooseOption(page, 'Second');

        sentFor = await send(`rank ${suffix}`);

        // * Verify the option id was sent and the post shows it
        expect(sentFor).toEqual([{field_id: rank.id, value: optionId(rank, 'Second')}]);
        await expect(postWithMessage(centre, `rank ${suffix}`).getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText(
            'Second',
        );
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const scope = channelsPage.centerView.postCreate.container;

        // # Pick them third, first, second
        await stageField(page, scope, third);
        await stageField(page, scope, first);
        await stageField(page, scope, second);

        // * Verify the chips are in the order picked, each before the inline add control
        const row = composerChips(scope);
        await expect(row.locator('[data-testid^="post-attribute-chip-"]')).toHaveCount(3);
        const order = await row.locator('[data-testid^="post-attribute-chip-"]').evaluateAll((chips) => {
            return chips.map((chip) => chip.getAttribute('data-testid'));
        });
        expect(order).toEqual([third, first, second].map((field) => `post-attribute-chip-${field.name}`));

        const addFollowsEveryChip = await row.evaluate((element) => {
            const add = element.querySelector('[data-testid="post-attributes-add"]');
            const chips = Array.from(element.querySelectorAll('[data-testid^="post-attribute-chip-"]'));
            return (
                Boolean(add) &&
                chips.every((chip) => chip.compareDocumentPosition(add!) & Node.DOCUMENT_POSITION_FOLLOWING)
            );
        });
        expect(addFollowsEveryChip).toBe(true);

        // # Remove the three text chips, and stage a select field to change its value
        for (const field of [third, first, second]) {
            await composerRemove(scope, field).click();
        }
        await stageField(page, scope, level);
        await chooseOption(page, 'Low');
        await expect(composerTrigger(scope, level)).toContainText('Low');

        // # Reopen the staged value's menu and pick another
        await composerTrigger(scope, level).click();
        await chooseOption(page, 'High');

        // * Verify the chip shows the new value
        await expect(composerTrigger(scope, level)).toContainText('High');
        await expect(composerTrigger(scope, level)).not.toContainText('Low');

        // # Hover the chip
        await composerTrigger(scope, level).hover();

        // * Verify the field's name is its tooltip
        await expect(page.getByRole('tooltip', {name: level.name})).toBeVisible();

        // # Remove it, then pick the field again and close its menu with Escape without choosing
        await composerRemove(scope, level).click();
        await stageField(page, scope, level);
        await expect(page.getByRole('menuitemradio', {name: 'Low', exact: true})).toBeVisible();
        await page.keyboard.press('Escape');

        // * Verify the chip went away and the field is offered again
        await expect(composerChip(scope, level)).toHaveCount(0);
        await composerPlus(scope).click();
        await expect(pickerItem(page, level)).toBeVisible();
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;

        // # Stage an always-visible field with a value and remove it with the pointer
        await stageField(page, scope, always);
        await chooseOption(page, 'Yes');
        await composerRemove(scope, always).click();

        // * Verify the chip is gone and the field is offered again
        await expect(composerChip(scope, always)).toHaveCount(0);
        await composerPlus(scope).click();
        await expect(pickerItem(page, always)).toBeVisible();
        await page.keyboard.press('Escape');

        // # Stage two text fields with values
        await stageField(page, scope, kept);
        await composerInput(scope, kept).fill('keep me');
        await composerInput(scope, kept).press('Enter');
        await stageField(page, scope, dropped);
        await composerInput(scope, dropped).fill('drop me');

        // # Tab from the input to its chip's × and press Enter
        await page.keyboard.press('Tab');
        await expect(composerRemove(scope, dropped)).toBeFocused();
        await page.keyboard.press('Enter');

        // * Verify the chip is gone and its field is offered again
        await expect(composerChip(scope, dropped)).toHaveCount(0);
        await composerPlus(scope).click();
        await expect(pickerItem(page, dropped)).toBeVisible();
        await page.keyboard.press('Escape');

        // # Send
        await composer.writeMessage(`removed ${suffix}`);
        const request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify only the kept value is in the request
        expect(sentValues(await request)).toEqual([{field_id: kept.id, value: 'keep me'}]);
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const scope = channelsPage.centerView.postCreate.container;

            // * Verify nothing is staged on its own, the always-visible field included
            await expect(composerChips(scope)).toHaveCount(0);

            // # Open the picker
            await composerPlus(scope).click();

            // * Verify the settable fields are offered, the always-visible one among them, and the
            // fields a member may not set, and the one nobody may, are not
            for (const field of [alpha, beta, gamma, delta, always]) {
                await expect(pickerItem(page, field)).toBeVisible();
            }
            await expect(pickerItem(page, adminsOnly)).toHaveCount(0);
            await expect(pickerItem(page, nobody)).toHaveCount(0);

            // * Verify the search box has focus
            const search = page.getByTestId('post-attributes-composer-add-search');
            await expect(search).toBeFocused();

            // # Search by name, in capitals to show the match ignores case
            await search.fill(`ALPHA_${suffix}`.toUpperCase());

            // * Verify only the matching field is left
            await expect(pickerItem(page, alpha)).toBeVisible();
            await expect(pickerItem(page, beta)).toHaveCount(0);

            // # Search for something every one of the suite's fields matches, then press ArrowDown
            await search.fill(`_${suffix}`);
            await expect(pickerItem(page, beta)).toBeVisible();
            await search.press('ArrowDown');

            // * Verify focus moved into the list
            await expect(page.getByRole('menuitem').first()).toBeFocused();
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify neither add control is shown once every settable field is staged.
 *
 * @precondition The PostAttributes feature flag is enabled, and no other system-scoped
 * post attribute field exists on the server: a field this spec did not create would
 * stay unstaged, so the case can only be proven on a clean server.
 */
test('hides both add controls when every settable field is staged', {tag: '@post_attributes'}, async ({pw}) => {
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const scope = channelsPage.centerView.postCreate.container;

        // # Stage the first field: one is still left to offer
        await stageField(page, scope, one);

        // * Verify both add controls are there
        await expect(composerPlus(scope)).toBeVisible();
        await expect(composerInlineAdd(scope)).toBeVisible();

        // # Stage the second, which is the last
        await stageField(page, scope, two);

        // * Verify neither add control is shown
        await expect(composerChip(scope, two)).toBeVisible();
        await expect(composerPlus(scope)).toHaveCount(0);
        await expect(composerInlineAdd(scope)).toHaveCount(0);
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
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];
        const config = await adminClient.getConfig();
        const collapsedThreads = config.ServiceSettings.CollapsedThreads;

        try {
            await purgeFields(adminClient);

            // # Keep replies in the centre, so threads are opened from there
            await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

            const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
            const other = await createField(adminClient, fieldName('other', suffix), {type: 'text'});
            created.push(note, other);

            const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
            const firstRoot = await userClient.createTestPost({
                channel_id: townSquare.id,
                message: `first root ${suffix}`,
            });
            const secondRoot = await userClient.createTestPost({
                channel_id: townSquare.id,
                message: `second root ${suffix}`,
            });

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const centre = channelsPage.centerView.postCreate.container;
            const thread = channelsPage.sidebarRight.postCreate.container;

            // # Stage a value in the centre, then change channel and come back
            await stageField(page, centre, note);
            await composerInput(centre, note).fill('staged');
            await expect(composerChip(centre, note)).toBeVisible();
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await expect(page).toHaveURL(/off-topic/);

            // * Verify the composer is empty in the other channel
            await expect(composerChips(channelsPage.centerView.postCreate.container)).toHaveCount(0);

            await channelsPage.sidebarLeft.goToItem('town-square');
            await expect(page).toHaveURL(/town-square/);

            // * Verify it is still empty when back
            await expect(composerChips(centre)).toHaveCount(0);

            // # Open the first thread and stage a value in its composer
            const first = await channelsPage.centerView.getPostById(firstRoot.id);
            await first.openAThread();
            await channelsPage.sidebarRight.toBeVisible();
            await stageField(page, thread, note);
            await composerInput(thread, note).fill('in thread');
            await composerInput(thread, note).press('Enter');

            // * Verify the centre composer is left alone
            await expect(composerChip(thread, note)).toBeVisible();
            await expect(composerChips(centre)).toHaveCount(0);

            // # Stage in the centre too
            await stageField(page, centre, other);

            // * Verify the thread composer still holds only its own
            await expect(composerChip(centre, other)).toBeVisible();
            await expect(composerChip(thread, other)).toHaveCount(0);
            await expect(composerChip(thread, note)).toBeVisible();

            // # Open the second thread
            const second = await channelsPage.centerView.getPostById(secondRoot.id);
            await second.openAThread();

            // * Verify the thread composer is empty, and the centre one kept its chip
            await expect(composerChips(thread)).toHaveCount(0);
            await expect(composerChip(centre, other)).toBeVisible();
        } finally {
            await deleteFields(adminClient, created);
            await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: collapsedThreads}});
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];
    const collapsedThreads = (await adminClient.getConfig()).ServiceSettings.CollapsedThreads;

    try {
        await purgeFields(adminClient);

        // # Keep replies in the centre
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const root = await userClient.createTestPost({channel_id: townSquare.id, message: `root ${suffix}`});

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open the thread, stage a value in its composer and send a reply
        const rootOnScreen = await channelsPage.centerView.getPostById(root.id);
        await rootOnScreen.openAThread();
        await channelsPage.sidebarRight.toBeVisible();

        const reply = channelsPage.sidebarRight.postCreate;
        await stageField(page, reply.container, note);
        await composerInput(reply.container, note).fill('on the reply');
        await composerInput(reply.container, note).press('Enter');

        await reply.writeMessage(`reply ${suffix}`);
        const request = waitForCreatePost(page);
        await reply.sendMessage();

        // * Verify the values rode on the reply, which is part of the root's thread
        const body = (await request).postDataJSON();
        expect(body.root_id).toBe(root.id);
        expect(sentValues(await request)).toEqual([{field_id: note.id, value: 'on the reply'}]);

        // * Verify the chip renders in the thread sidebar and in the centre column
        await expect(
            channelsPage.sidebarRight.container
                .getByTestId('rhsPostView')
                .filter({hasText: `reply ${suffix}`})
                .getByTestId(CHIPS)
                .getByTestId(TEXT_CHIP),
        ).toHaveText('on the reply');
        await expect(
            postWithMessage(channelsPage.centerView.container, `reply ${suffix}`)
                .getByTestId(CHIPS)
                .getByTestId(TEXT_CHIP),
        ).toHaveText('on the reply');
    } finally {
        await deleteFields(adminClient, created);
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: collapsedThreads}});
    }
});

/**
 * @objective Verify an emoji reaction sent with values staged reacts to the last post,
 * creates no post, and leaves the staged chips in place.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('keeps staged values when a message becomes a reaction', {tag: '@post_attributes'}, async ({pw}) => {
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;

        // # Stage a value
        await stageField(page, composer.container, level);
        await chooseOption(page, 'High');

        // # Send `+:smile:`, watching for posts and for the reaction
        const createdPosts: string[] = [];
        page.on('request', (request) => {
            if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v4/posts')) {
                createdPosts.push(request.url());
            }
        });
        const reaction = page.waitForResponse((response) => {
            return response.request().method() === 'POST' && response.url().endsWith('/api/v4/reactions');
        });
        await composer.writeMessage('+:smile:');
        await composer.sendMessage();
        await reaction;

        // * Verify the reaction landed on the last post and no post was created
        const reacted = await adminClient.getPost(last.id);
        expect(reacted.metadata.reactions?.map((r) => r.emoji_name)).toEqual(['smile']);
        expect(createdPosts).toEqual([]);

        // * Verify the staged chip is still there, with its value
        await expect(composerTrigger(composer.container, level)).toContainText('High');
        await expect(composer.input).toHaveValue('');
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const level = await createField(adminClient, fieldName('level', suffix), {options: ['Low', 'High']});
        created.push(level);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;

        // # Stage a value and run `/echo hi`
        await stageField(page, composer.container, level);
        await chooseOption(page, 'High');

        const command = page.waitForResponse((response) => response.url().endsWith('/api/v4/commands/execute'));
        await composer.writeMessage('/echo hi');
        await composer.input.press('Enter');
        await command;

        // * Verify the command ran, the box is empty and the value is still staged
        await expect(composer.input).toHaveValue('');
        await expect(composerTrigger(composer.container, level)).toContainText('High');

        // # Send a message
        await composer.writeMessage(`after command ${suffix}`);
        const request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify it carries the value and the chips are cleared
        expect(sentValues(await request)).toEqual([{field_id: level.id, value: optionId(level, 'High')}]);
        await expect(composerChips(composer.container)).toHaveCount(0);
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];
    const scheduledPosts = (await adminClient.getConfig()).ServiceSettings.ScheduledPosts;

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {ScheduledPosts: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;
        const chevron = scope.locator('#button_send_post_options');

        // # Write a message, so the chevron is enabled for reasons that have nothing to do with values
        await composer.writeMessage(`schedule ${suffix}`);
        await expect(chevron).toBeEnabled();

        // # Stage a value
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('staged');
        await composerInput(scope, note).press('Enter');

        // * Verify the chevron is disabled
        await expect(chevron).toBeDisabled();

        // # Hover what wraps it
        await scope.locator('.send_post_options_blocked').hover();

        // * Verify the tooltip says why
        await expect(page.getByRole('tooltip', {name: /Messages with attributes can.t be scheduled/})).toBeVisible();

        // # Remove the only value
        await composerRemove(scope, note).click();

        // * Verify scheduling is available again
        await expect(chevron).toBeEnabled();

        // # Stage a value again and send
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('sent');
        await composerInput(scope, note).press('Enter');
        await expect(chevron).toBeDisabled();

        const request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify Send still works, and carries the value
        expect(sentValues(await request)).toEqual([{field_id: note.id, value: 'sent'}]);
    } finally {
        await deleteFields(adminClient, created);
        await adminClient.patchConfig({ServiceSettings: {ScheduledPosts: scheduledPosts}});
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    await pw.skipIfNoLicense();

    const license = await adminClient.getClientLicenseOld();
    test.skip(
        !['advanced', 'entry'].includes(license.SkuShortName),
        'burn-on-read needs an Enterprise Advanced or Entry licence',
    );

    const enableBurnOnRead = (await adminClient.getConfig()).ServiceSettings.EnableBurnOnRead;

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;

        // * Verify burn-on-read is available while nothing is staged
        await expect(composer.burnOnReadButton).toBeEnabled();

        // # Stage a value
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('staged');
        await composerInput(scope, note).press('Enter');

        // * Verify burn-on-read is disabled, and its tooltip says why
        await expect(composer.burnOnReadButton).toBeDisabled();
        await scope.getByTestId('burn-on-read-blocked').hover();
        await expect(page.getByRole('tooltip', {name: /Messages with attributes can.t be burn-on-read/})).toBeVisible();

        // # Remove the chip
        await composerRemove(scope, note).click();

        // * Verify burn-on-read is enabled again
        await expect(composer.burnOnReadButton).toBeEnabled();

        // # Turn burn-on-read on
        await composer.toggleBurnOnRead();
        await composer.toHaveBurnOnReadLabel();

        // * Verify the `+` is disabled with its reason, and no inline add control exists to
        // outlive it, since no chip can be staged
        await expect(composerPlus(scope)).toBeDisabled();
        await scope.getByTestId('post-attributes-composer-add-blocked').hover();
        await expect(page.getByRole('tooltip', {name: /Burn-on-read messages can.t have attributes/})).toBeVisible();
        await expect(composerInlineAdd(scope)).toHaveCount(0);

        // # Turn it off
        await composer.toggleBurnOnRead();
        await composer.toHaveNoBurnOnReadLabel();

        // * Verify the `+` is enabled again
        await expect(composerPlus(scope)).toBeEnabled();

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
        await adminClient.patchConfig({ServiceSettings: {EnableBurnOnRead: enableBurnOnRead}});
    }
});

/**
 * @objective Verify staged values never reach drafts: the message comes back after a reload
 * and after a channel switch, and no attribute does.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('restores the message from a draft but not the staged values', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;
        const message = `draft ${suffix}`;

        // # Type a message and stage a value
        await composer.writeMessage(message);
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('staged');
        await composerInput(scope, note).press('Enter');
        await expect(composerChip(scope, note)).toBeVisible();

        // # Reload
        await page.reload();
        await channelsPage.toBeVisible();

        // * Verify the message came back and no attribute did
        await expect(composer.input).toHaveValue(message);
        await expect(composerChips(scope)).toHaveCount(0);

        // # Stage again, then change channel and come back
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('staged again');
        await composerInput(scope, note).press('Enter');
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await expect(page).toHaveURL(/off-topic/);
        await channelsPage.sidebarLeft.goToItem('town-square');
        await expect(page).toHaveURL(/town-square/);

        // * Verify the same
        await expect(composer.input).toHaveValue(message);
        await expect(composerChips(scope)).toHaveCount(0);
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    const {adminClient, user, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];
    const postPriority = (await adminClient.getConfig()).ServiceSettings.PostPriority;

    try {
        await purgeFields(adminClient);
        await adminClient.patchConfig({ServiceSettings: {PostPriority: true}});

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        created.push(note);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const composer = channelsPage.centerView.postCreate;
        const scope = composer.container;
        const centre = channelsPage.centerView.container;

        // # Attach a file and stage a value
        await composer.writeMessage(`with file ${suffix}`);
        await scope.locator('input[type="file"]').setInputFiles({
            name: 'attached.png',
            mimeType: 'image/png',
            buffer: Buffer.from(ONE_PIXEL_PNG, 'base64'),
        });
        await composer.waitUntilFilePreviewContains(['attached.png']);
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('with a file');
        await composerInput(scope, note).press('Enter');

        let request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify both arrived
        let body = (await request).postDataJSON();
        expect(body.file_ids).toHaveLength(1);
        expect(sentValues(await request)).toEqual([{field_id: note.id, value: 'with a file'}]);
        const withFile = postWithMessage(centre, `with file ${suffix}`);
        await expect(withFile.locator('img[src*="/api/v4/files/"]').first()).toBeVisible();
        await expect(withFile.getByTestId(CHIPS).getByTestId(TEXT_CHIP)).toHaveText('with a file');

        // # Set a priority and stage a value
        await composer.writeMessage(`with priority ${suffix}`);
        await composer.openPriorityMenu();
        await channelsPage.messagePriority.selectPriority('Important');
        await channelsPage.messagePriority.apply();
        await stageField(page, scope, note);
        await composerInput(scope, note).fill('with a label');
        await composerInput(scope, note).press('Enter');

        request = waitForCreatePost(page);
        await composer.sendMessage();

        // * Verify both arrived
        body = (await request).postDataJSON();
        expect(body.metadata.priority.priority).toBe('important');
        expect(sentValues(await request)).toEqual([{field_id: note.id, value: 'with a label'}]);
        const withPriority = postWithMessage(centre, `with priority ${suffix}`);
        await channelsPage.messagePriority.verifyPriorityLabel(withPriority, 'Important');
        await expect(withPriority.getByTestId(CHIPS).getByTestId(TEXT_CHIP)).toHaveText('with a label');
    } finally {
        await deleteFields(adminClient, created);
        await adminClient.patchConfig({ServiceSettings: {PostPriority: postPriority}});
    }
});

// A one-pixel PNG, the smallest thing the server accepts as an image.
const ONE_PIXEL_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * @objective Verify a direct and a group message offer system- and channel-scoped fields, and
 * never a team-scoped one, and send values.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test(
    'applies system and channel fields in direct and group messages, not team ones',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeFields(adminClient);

            const alice = await adminClient.createUser(await pw.random.user('alice'), '', '');
            const bob = await adminClient.createUser(await pw.random.user('bob'), '', '');
            const dm = await adminClient.createDirectChannel([user.id, alice.id]);
            const gm = await adminClient.createGroupChannel([user.id, alice.id, bob.id]);

            // # A system field, a team field, and a field scoped to each message
            const everywhere = await createField(adminClient, fieldName('everywhere', suffix), {
                options: ['Low', 'High'],
            });
            const teamOnly = await createField(adminClient, fieldName('teamonly', suffix), {
                type: 'text',
                teamId: team.id,
            });
            const inDm = await createField(adminClient, fieldName('indm', suffix), {type: 'text', channelId: dm.id});
            const inGm = await createField(adminClient, fieldName('ingm', suffix), {type: 'text', channelId: gm.id});
            created.push(everywhere, teamOnly, inDm, inGm);

            const {page, channelsPage} = await pw.testBrowser.login(user);

            for (const [label, scoped] of [
                ['dm', inDm],
                ['gm', inGm],
            ] as const) {
                // # Open the conversation
                if (label === 'dm') {
                    await channelsPage.goto(team.name, `@${alice.username}`);
                } else {
                    await channelsPage.gotoMessage(team.name, gm.name);
                }
                await channelsPage.toBeVisible();

                const composer = channelsPage.centerView.postCreate;
                const scope = composer.container;

                // * Verify the system and channel fields are offered and the team field is not
                await composerPlus(scope).click();
                await expect(pickerItem(page, everywhere)).toBeVisible();
                await expect(pickerItem(page, scoped)).toBeVisible();
                await expect(pickerItem(page, teamOnly)).toHaveCount(0);
                await page.keyboard.press('Escape');

                // # Stage one of each and send
                await stageField(page, scope, everywhere);
                await chooseOption(page, 'High');
                await stageField(page, scope, scoped);
                await composerInput(scope, scoped).fill(`in the ${label}`);
                await composerInput(scope, scoped).press('Enter');

                await composer.writeMessage(`${label} ${suffix}`);
                const request = waitForCreatePost(page);
                await composer.sendMessage();

                // * Verify both values were sent and are on the post
                expect(sentValues(await request)).toEqual(
                    expect.arrayContaining([
                        {field_id: everywhere.id, value: optionId(everywhere, 'High')},
                        {field_id: scoped.id, value: `in the ${label}`},
                    ]),
                );
                const sent = postWithMessage(channelsPage.centerView.container, `${label} ${suffix}`);
                await expect(sent.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('High');
                await expect(sent.getByTestId(CHIPS).getByTestId(TEXT_CHIP)).toHaveText(`in the ${label}`);
            }
        } finally {
            await deleteFields(adminClient, created);
        }
    },
);

/**
 * @objective Verify editing a sent post's message, in the composer's edit mode, shows no
 * attribute chips or add control and leaves the post's values as they were.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('edits a message without touching its attributes', {tag: '@post_attributes'}, async ({pw}) => {
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

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const onScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(onScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('High');

        // # Open the post for editing from the empty composer
        await channelsPage.centerView.postCreate.input.press('ArrowUp');
        const edit = channelsPage.centerView.postEdit;
        await expect(edit.input).toBeVisible();

        // * Verify the edit box has no chips and no add control
        await expect(edit.container.getByTestId('post-attributes-composer')).toHaveCount(0);
        await expect(composerPlus(edit.container)).toHaveCount(0);
        await expect(composerInlineAdd(edit.container)).toHaveCount(0);

        // # Change the message and save
        await edit.input.fill(`edited ${suffix}`);
        const patch = page.waitForRequest((request) => {
            return request.method() === 'PUT' && new URL(request.url()).pathname.includes(`/api/v4/posts/${post.id}`);
        });
        await edit.sendMessageButton.click();

        // * Verify the post kept its chip
        await patch;
        await expect(onScreen.container).toContainText(`edited ${suffix}`);
        await expect(onScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('High');

        // # Reload, so what is shown is what the server stored
        await page.reload();
        await channelsPage.toBeVisible();

        // * Verify the value is unchanged
        const reloaded = await channelsPage.centerView.getPostById(post.id);
        await expect(reloaded.container).toContainText(`edited ${suffix}`);
        await expect(reloaded.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('High');
    } finally {
        await deleteFields(adminClient, created);
    }
});
