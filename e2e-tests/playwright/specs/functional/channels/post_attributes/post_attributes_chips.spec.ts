// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    HYDRATION_PARAM,
    VALUES_ROUTE,
    createField,
    deleteFields,
    fieldName,
    optionId,
    purgeFields,
    recordRequests,
    setPostValues,
} from './support';

const CHIPS = 'post-attributes-chips';
const OVERFLOW = 'post-attributes-overflow';

// One testid per renderer. Asserting on these rather than on text alone is what proves a
// field type reached the renderer its type selects, not merely that something drew.
// `select`, `multiselect` and `rank` deliberately share one — the option-bearing family
// has a single renderer, and the arity cap is what separates them.
const OPTION_CHIP = 'select-property';
const TEXT_CHIP = 'text-property';
const USER_CHIP = 'user-property';

// Colour tokens an option can carry. Option chips ignore them: global attributes have no
// colours yet, so every option draws in the same neutral whatever it stores.
const RED_TOKEN = 'red';
const BLUE_TOKEN = 'blue';

// What a chip that lost its background computes to. The neutral is translucent, so
// matching `rgba(` alone would accept it.
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/**
 * @objective Verify a post's attribute chips are on screen from the channel load alone,
 * without any per-post request for its values.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders attribute chips on first paint without fetching values', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one system-scoped select field and set it on a post
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'hydrated post'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        // # Start recording requests before the first navigation, since the channel
        // load is where a regression would show
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const valuesRequests = recordRequests(page, VALUES_ROUTE);

        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the chip is on screen with the option's name, not its stored id
        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(postOnScreen.container.getByTestId(CHIPS)).toBeVisible();
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();

        // * Verify the values arrived on the post itself: nothing asked the per-post
        // values endpoint for them. This is the spec's central claim.
        expect(valuesRequests).toEqual([]);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the channel posts request asks the server to hydrate property values.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('asks the posts endpoint to hydrate', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Arm the wait before the navigation that triggers the fetch
    const {user, team} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);
    const hydrated = page.waitForResponse((response) => response.url().includes(HYDRATION_PARAM));

    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // * Verify a posts request carried the hydration parameter. The wait is the
    // assertion: it resolves on the first matching response and fails the test on the
    // timeout if none arrives.
    await hydrated;
});

/**
 * @objective Verify the whole feature is inert when the flag is off: no hydration
 * parameter is sent and no chips are drawn.
 *
 * @precondition The PostAttributes feature flag is enabled server-side; this test turns
 * it off for one browser only.
 */
test('sends no parameter and draws no chips with the flag off', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field and set it, so the only reason no chip appears is the flag
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'unflagged post'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Turn the flag off for this browser only. Patching the server config would
        // flip it for every spec running in parallel; rewriting the client config
        // response keeps the blast radius to this page.
        await page.route('**/api/v4/config/client?format=old', async (route) => {
            const response = await route.fetch();
            const config = await response.json();

            await route.fulfill({json: {...config, FeatureFlagPostAttributes: 'false'}});
        });

        const hydrationRequests = recordRequests(page, HYDRATION_PARAM);

        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the post rendered but carries no chip row
        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(postOnScreen.container).toContainText('unflagged post');
        await expect(postOnScreen.container.getByTestId(CHIPS)).toHaveCount(0);

        // * Verify nothing asked the server to hydrate
        expect(hydrationRequests).toEqual([]);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify chips render in the RHS on both the thread root and a reply.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders chips on the RHS root and on a reply', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, then set it on both a root post and its reply
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
        const root = await userClient.createTestPost({channel_id: channel.id, message: 'thread root'});
        const reply = await userClient.createTestPost({
            channel_id: channel.id,
            root_id: root.id,
            message: 'thread reply',
        });

        await setPostValues(adminClient, root.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);
        await setPostValues(adminClient, reply.id, [
            {field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the chip is on the root in the centre channel
        const rootInCenter = await channelsPage.centerView.getPostById(root.id);
        await expect(rootInCenter.container.getByText('SECRET', {exact: true})).toBeVisible();

        // # Open the thread in the RHS
        await rootInCenter.reply();
        await channelsPage.sidebarRight.toBeVisible();

        // * Verify the same root carries its chip in the RHS. A value set on a reply has
        // never been gated to roots server-side, so gating it here would make it
        // permanently invisible.
        const rootInRhs = await channelsPage.sidebarRight.getPostById(root.id);
        await expect(rootInRhs.container.getByText('SECRET', {exact: true})).toBeVisible();

        // * Verify the reply carries its own, different chip
        const replyInRhs = await channelsPage.sidebarRight.getPostById(reply.id);
        await expect(replyInRhs.container.getByText('UNCLASSIFIED', {exact: true})).toBeVisible();
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify the row stops at two chips and reports the rest as an overflow badge.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders two chips and a +1 badge for three set fields', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision three ordered fields and set all three on one post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const first = await createField(adminClient, fieldName('first', suffix), {
            options: ['SECRET'],
            sortOrder: 1,
        });
        const second = await createField(adminClient, fieldName('second', suffix), {
            options: ['NOFORN'],
            sortOrder: 2,
        });
        const third = await createField(adminClient, fieldName('third', suffix), {
            options: ['ORCON'],
            sortOrder: 3,
        });
        created.push(first, second, third);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'three attributes'});
        await setPostValues(adminClient, post.id, [
            {field_id: first.id, value: optionId(first, 'SECRET')},
            {field_id: second.id, value: optionId(second, 'NOFORN')},
            {field_id: third.id, value: optionId(third, 'ORCON')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);

        // * Verify the first two fields drew chips, in sort_order
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();
        await expect(postOnScreen.container.getByText('NOFORN', {exact: true})).toBeVisible();

        // * Verify the third became the badge rather than a third chip
        await expect(postOnScreen.container.getByText('ORCON', {exact: true})).toHaveCount(0);
        await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveText('+1');
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a field that applies but holds no value draws nothing.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('draws no chip for a field that is not set', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision two fields and set only one of them
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const set = await createField(adminClient, fieldName('set', suffix), {options: ['SECRET'], sortOrder: 1});
        const unset = await createField(adminClient, fieldName('unset', suffix), {
            options: ['NOFORN'],
            visibility: 'when_set',
            sortOrder: 2,
        });
        created.push(set, unset);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'one of two set'});
        await setPostValues(adminClient, post.id, [{field_id: set.id, value: optionId(set, 'SECRET')}]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);

        // * Verify the set field drew its chip
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();

        // * Verify the unset field drew nothing at all — no placeholder, and no slot
        // spent that would push a later attribute into the overflow badge
        await expect(postOnScreen.container.getByText('NOFORN', {exact: true})).toHaveCount(0);
        await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a value changed elsewhere reaches an open channel over the websocket,
 * without a reload.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('updates a chip when another session changes the value', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, set it, and open the channel
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'about to change'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();

        // # Change the value from another session entirely
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')},
        ]);

        // * Verify the chip followed without a reload. This is why the row reads the
        // property values slice rather than the post's metadata: the websocket event
        // lands in that slice, and nothing re-delivers the post.
        await expect(postOnScreen.container.getByText('UNCLASSIFIED', {exact: true})).toBeVisible();
        await expect(postOnScreen.container.getByText('SECRET', {exact: true})).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify each field type that has a renderer draws its chip through that
 * renderer, showing resolved content rather than the stored value.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders every single-chip field type through its own renderer', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one field of each type that draws exactly one chip
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const note = await createField(adminClient, fieldName('note', suffix), {type: 'text'});
        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        const priority = await createField(adminClient, fieldName('priority', suffix), {
            type: 'rank',
            options: ['HIGH'],
        });
        const owner = await createField(adminClient, fieldName('owner', suffix), {type: 'user'});
        created.push(note, classification, priority, owner);

        // # Give each field its own post, so every post draws exactly one chip and the
        // two-chip budget never enters into it
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const textPost = await userClient.createTestPost({channel_id: channel.id, message: 'text field'});
        await setPostValues(adminClient, textPost.id, [{field_id: note.id, value: 'Q3 planning'}]);

        const selectPost = await userClient.createTestPost({channel_id: channel.id, message: 'select field'});
        await setPostValues(adminClient, selectPost.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const rankPost = await userClient.createTestPost({channel_id: channel.id, message: 'rank field'});
        await setPostValues(adminClient, rankPost.id, [{field_id: priority.id, value: optionId(priority, 'HIGH')}]);

        const userPost = await userClient.createTestPost({channel_id: channel.id, message: 'user field'});
        await setPostValues(adminClient, userPost.id, [{field_id: owner.id, value: user.id}]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify a text field renders its stored string through the text renderer
        const textOnScreen = await channelsPage.centerView.getPostById(textPost.id);
        const textChip = textOnScreen.container.getByTestId(TEXT_CHIP);

        await expect(textChip).toHaveText('Q3 planning');

        // * Verify a select renders the option's name, never the stored option id
        const selectOnScreen = await channelsPage.centerView.getPostById(selectPost.id);
        const selectChip = selectOnScreen.container.getByTestId(OPTION_CHIP);

        await expect(selectChip).toHaveText('SECRET');

        // * Verify the text value is drawn as the same chip as an option, in the same
        // neutral. Neither field carries a colour, so comparing the two against each
        // other pins them together without naming a value that changes with the theme.
        const neutralBackground = await selectChip.evaluate((el: Element) => getComputedStyle(el).backgroundColor);

        await expect(textChip).toHaveCSS('background-color', neutralBackground);
        await expect(textChip).toHaveCSS(
            'border-radius',
            await selectChip.evaluate((el: Element) => getComputedStyle(el).borderRadius),
        );
        await expect(textChip).toHaveCSS(
            'font-weight',
            await selectChip.evaluate((el: Element) => getComputedStyle(el).fontWeight),
        );
        await expect(textChip).toHaveCSS(
            'padding',
            await selectChip.evaluate((el: Element) => getComputedStyle(el).padding),
        );

        // * Verify a rank goes through that same option renderer and draws one chip
        const rankOnScreen = await channelsPage.centerView.getPostById(rankPost.id);
        await expect(rankOnScreen.container.getByTestId(OPTION_CHIP)).toHaveText('HIGH');

        // * Verify a user field resolves the id to a name. TeammateNameDisplay is
        // 'username' in the E2E config baseline, so that is what it resolves to.
        const userOnScreen = await channelsPage.centerView.getPostById(userPost.id);
        const userChip = userOnScreen.container.getByTestId(USER_CHIP);

        await expect(userChip).toContainText(user.username);
        await expect(userChip).not.toContainText(user.id);

        // * Verify the chip carries the avatar beside the name. A user value is the one
        // chip that is not text alone, and the name assertion above would hold without it.
        await expect(userChip.locator('img')).toBeVisible();
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a multiselect draws one chip per stored entry, where the other
 * option-bearing types draw exactly one whatever they hold.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders one chip per entry of a multiselect', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a multiselect and set two of its options on a post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const caveats = await createField(adminClient, fieldName('caveats', suffix), {
            type: 'multiselect',
            options: [
                {name: 'NOFORN', color: RED_TOKEN},
                {name: 'ORCON', color: BLUE_TOKEN},
            ],
        });
        created.push(caveats);

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'two caveats'});
        await setPostValues(adminClient, post.id, [
            {field_id: caveats.id, value: [optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);

        // * Verify both entries drew their own chip, from the one field
        await expect(postOnScreen.container.getByTestId(OPTION_CHIP)).toHaveCount(2);
        await expect(postOnScreen.container.getByText('NOFORN', {exact: true})).toBeVisible();
        await expect(postOnScreen.container.getByText('ORCON', {exact: true})).toBeVisible();

        // * Verify the two chips are the same neutral although their options carry
        // different colours, and carry no inline style that could colour them
        const noforn = postOnScreen.container.getByTestId(OPTION_CHIP).filter({hasText: 'NOFORN'});
        const orcon = postOnScreen.container.getByTestId(OPTION_CHIP).filter({hasText: 'ORCON'});
        const nofornBackground = await noforn.evaluate((el: Element) => getComputedStyle(el).backgroundColor);
        const nofornColour = await noforn.evaluate((el: Element) => getComputedStyle(el).color);

        await expect(orcon).toHaveCSS('background-color', nofornBackground);
        await expect(orcon).toHaveCSS('color', nofornColour);
        await expect(noforn).toHaveCSS('background-color', /^rgba\(/);
        await expect(noforn).not.toHaveCSS('background-color', TRANSPARENT);
        await expect(noforn).not.toHaveAttribute('style', /./);
        await expect(orcon).not.toHaveAttribute('style', /./);

        // * Verify two entries exactly fill the budget, leaving nothing to overflow
        await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify option chips are neutral: an option that carries a palette colour, no
 * colour, or a token nothing recognises all draw the same, with no inline colour.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('draws option chips in a neutral, whatever colour the option carries', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one select carrying a palette colour, no colour, and a token nothing
    // recognises. The server stores options as opaque maps, so the colours round-trip
    // exactly as written and the only thing keeping them off screen is the chip.
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [{name: 'SECRET', color: RED_TOKEN}, 'PLAIN', {name: 'ODD', color: 'chartreuse'}],
        });
        created.push(classification);

        // # One post per option, so each draws a single chip
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const chipFor: Record<string, string> = {};

        for (const name of ['SECRET', 'PLAIN', 'ODD']) {
            const post = await userClient.createTestPost({channel_id: channel.id, message: `option ${name}`});
            await setPostValues(adminClient, post.id, [
                {field_id: classification.id, value: optionId(classification, name)},
            ]);
            chipFor[name] = post.id;
        }

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the chip of an option with no colour draws in a translucent neutral.
        // The alpha channel is the tell: palette backgrounds are opaque, the neutral is a
        // theme token at a low alpha, so this holds whatever theme the account is on.
        const plainOnScreen = await channelsPage.centerView.getPostById(chipFor.PLAIN);
        const plainChip = plainOnScreen.container.getByTestId(OPTION_CHIP);

        await expect(plainChip).toHaveText('PLAIN');
        await expect(plainChip).toHaveCSS('background-color', /^rgba\(/);
        await expect(plainChip).not.toHaveCSS('background-color', TRANSPARENT);

        const neutralBackground = await plainChip.evaluate((el: Element) => getComputedStyle(el).backgroundColor);
        const neutralForeground = await plainChip.evaluate((el: Element) => getComputedStyle(el).color);

        // * Verify the options that carry a colour draw the same neutral, and no inline
        // style was put on them
        for (const name of ['SECRET', 'ODD']) {
            const onScreen = await channelsPage.centerView.getPostById(chipFor[name]);
            const chip = onScreen.container.getByTestId(OPTION_CHIP);

            await expect(chip).toHaveText(name);

            await expect(chip).toHaveCSS('background-color', neutralBackground);

            await expect(chip).toHaveCSS('color', neutralForeground);

            await expect(chip).not.toHaveAttribute('style', /./);
        }
    } finally {
        await deleteFields(adminClient, created);
    }
});
