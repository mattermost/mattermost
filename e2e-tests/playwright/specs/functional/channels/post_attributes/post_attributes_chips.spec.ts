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

// Two boards palette tokens and the background each resolves to, from COLOR_DESCRIPTOR
// in utils/board_property_colors. Hard-coded rather than imported: the point is to catch
// the pairing drifting, and importing the same table the code reads would not.
const RED_TOKEN = {name: 'red', background: 'rgb(243, 164, 160)'};
const BLUE_TOKEN = {name: 'blue', background: 'rgb(174, 201, 245)'};

// Every one of the nine palette tokens is a pale pastel, so the derived foreground is
// black for all of them. Derived by getContrastingSimpleColor, never authored.
const DERIVED_FOREGROUND = 'rgb(0, 0, 0)';

/**
 * @objective Verify a post's attribute chips are on screen from the channel load alone,
 * without any per-post request for its values.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('renders attribute chips on first paint without fetching values', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
 * @objective Verify a field scoped to one channel does not draw chips in another.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('ignores a field scoped to a different channel', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

    // # Provision a field scoped to one channel, then set it on a post in another
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const owning = await adminClient.createPublicChannel(team.id, `owning-${suffix}`);
        const other = await adminClient.createPublicChannel(team.id, `other-${suffix}`);
        await adminClient.addToChannel(user.id, owning.id);
        await adminClient.addToChannel(user.id, other.id);

        const scoped = await createField(adminClient, fieldName('scoped', suffix), {
            options: ['SECRET'],
            channelId: owning.id,
        });
        created.push(scoped);

        // The value is written against a post in the *other* channel, so the only thing
        // keeping it off screen is the field's scope.
        const post = await userClient.createTestPost({channel_id: other.id, message: 'out of scope'});
        await setPostValues(adminClient, post.id, [{field_id: scoped.id, value: optionId(scoped, 'SECRET')}]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, other.name);
        await channelsPage.toBeVisible();

        const postOnScreen = await channelsPage.centerView.getPostById(post.id);

        // * Verify the post rendered without a chip row
        await expect(postOnScreen.container).toContainText('out of scope');
        await expect(postOnScreen.container.getByTestId(CHIPS)).toHaveCount(0);

        // # Open the channel the field does belong to
        await channelsPage.goto(team.name, owning.name);
        await channelsPage.toBeVisible();

        // * Verify the field applies there, so the absence above was scope and not a
        // broken fixture
        const inScope = await userClient.createTestPost({channel_id: owning.id, message: 'in scope'});
        await setPostValues(adminClient, inScope.id, [{field_id: scoped.id, value: optionId(scoped, 'SECRET')}]);

        const inScopeOnScreen = await channelsPage.centerView.getPostById(inScope.id);
        await expect(inScopeOnScreen.container.getByText('SECRET', {exact: true})).toBeVisible();
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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

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
        await expect(textOnScreen.container.getByTestId(TEXT_CHIP)).toHaveText('Q3 planning');

        // * Verify a select renders the option's name, never the stored option id
        const selectOnScreen = await channelsPage.centerView.getPostById(selectPost.id);
        await expect(selectOnScreen.container.getByTestId(OPTION_CHIP)).toHaveText('SECRET');

        // * Verify a rank goes through that same option renderer and draws one chip
        const rankOnScreen = await channelsPage.centerView.getPostById(rankPost.id);
        await expect(rankOnScreen.container.getByTestId(OPTION_CHIP)).toHaveText('HIGH');

        // * Verify a user field resolves the id to a name. TeammateNameDisplay is
        // 'username' in the E2E config baseline, so that is what it resolves to.
        const userOnScreen = await channelsPage.centerView.getPostById(userPost.id);
        await expect(userOnScreen.container.getByTestId(USER_CHIP)).toContainText(user.username);
        await expect(userOnScreen.container.getByTestId(USER_CHIP)).not.toContainText(user.id);
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
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

    // # Provision a multiselect and set two of its options on a post
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const caveats = await createField(adminClient, fieldName('caveats', suffix), {
            type: 'multiselect',
            options: [
                {name: 'NOFORN', color: RED_TOKEN.name},
                {name: 'ORCON', color: BLUE_TOKEN.name},
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

        // * Verify each chip took its own option's colour. Two different colours from one
        // field is what proves colour is resolved per option rather than per field.
        const noforn = postOnScreen.container.getByText('NOFORN', {exact: true});
        const orcon = postOnScreen.container.getByText('ORCON', {exact: true});

        await expect(noforn).toHaveCSS('background-color', RED_TOKEN.background);
        await expect(orcon).toHaveCSS('background-color', BLUE_TOKEN.background);
        await expect(noforn).toHaveCSS('color', DERIVED_FOREGROUND);
        await expect(orcon).toHaveCSS('color', DERIVED_FOREGROUND);

        // * Verify two entries exactly fill the budget, leaving nothing to overflow
        await expect(postOnScreen.container.getByTestId(OVERFLOW)).toHaveCount(0);
    } finally {
        await deleteFields(adminClient, created);
    }
});

/**
 * @objective Verify a select chip takes its colour from its own option, and that an
 * option with no colour or an unrecognised one still renders, in the theme-aware
 * neutral.
 *
 * @precondition The PostAttributes feature flag is enabled.
 */
test('colours a select chip from its option, falling back to neutral', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.skipIfFeatureFlagNotSet('PostAttributes', true);

    // # Provision one select carrying a palette colour, no colour, and a token nothing
    // recognises. The server stores options as opaque maps, so the third round-trips
    // exactly as written — which is the only way to reach the client's fallback for real.
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [{name: 'SECRET', color: RED_TOKEN.name}, 'PLAIN', {name: 'ODD', color: 'chartreuse'}],
        });
        created.push(classification);

        // # One post per option, so each draws a single chip
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const colouredPost = await userClient.createTestPost({channel_id: channel.id, message: 'palette colour'});
        await setPostValues(adminClient, colouredPost.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const plainPost = await userClient.createTestPost({channel_id: channel.id, message: 'no colour'});
        await setPostValues(adminClient, plainPost.id, [
            {field_id: classification.id, value: optionId(classification, 'PLAIN')},
        ]);

        const oddPost = await userClient.createTestPost({channel_id: channel.id, message: 'unrecognised colour'});
        await setPostValues(adminClient, oddPost.id, [
            {field_id: classification.id, value: optionId(classification, 'ODD')},
        ]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * Verify the palette token resolves to its background and to a derived
        // foreground, both opaque, so the pair holds its contrast in any theme
        const colouredOnScreen = await channelsPage.centerView.getPostById(colouredPost.id);
        const colouredChip = colouredOnScreen.container.getByTestId(OPTION_CHIP);

        await expect(colouredChip).toHaveCSS('background-color', RED_TOKEN.background);
        await expect(colouredChip).toHaveCSS('color', DERIVED_FOREGROUND);

        // * Verify an option with no colour still draws, in a translucent neutral. The
        // alpha channel is the tell: palette backgrounds are opaque hex, the neutral is a
        // theme token at 12%, so this holds whatever theme the account is on.
        const plainOnScreen = await channelsPage.centerView.getPostById(plainPost.id);
        const plainChip = plainOnScreen.container.getByTestId(OPTION_CHIP);

        await expect(plainChip).toHaveText('PLAIN');
        await expect(plainChip).toHaveCSS('background-color', /^rgba\(/);

        // * Verify an unrecognised colour lands on that same neutral rather than being
        // passed through to CSS or dropping the chip
        const neutralBackground = await plainChip.evaluate((el: Element) => getComputedStyle(el).backgroundColor);
        const oddOnScreen = await channelsPage.centerView.getPostById(oddPost.id);
        const oddChip = oddOnScreen.container.getByTestId(OPTION_CHIP);

        await expect(oddChip).toHaveText('ODD');
        await expect(oddChip).toHaveCSS('background-color', neutralBackground);
    } finally {
        await deleteFields(adminClient, created);
    }
});
