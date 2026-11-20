// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, test, waitForApi} from '@mattermost/playwright-lib';

import {
    GROUP,
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

/** One renderer part can draw several unkeyed option chips; match content inside that generated part. */
function optionWithText(renderer: {locator: Locator}, value: string): Locator {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return renderer.locator.filter({hasText: new RegExp(`^${escaped}$`)});
}

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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one system-scoped select field and set it on a post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'hydrated post'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        // # Start recording requests before the first navigation, since the channel
        // load is where a regression would show
        const {page, app} = await pw.testBrowser.login(user);
        const valuesRequests = recordRequests(page, VALUES_ROUTE);

        await app.channelsPage.goto({team, channel: channel.name});

        // * Verify the chip is on screen with the option's name, not its stored id
        const postOnScreen = app.center.postList.post(post);
        await expect(postOnScreen.attributes.container).toBeVisible();
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'SECRET')).toBeVisible();

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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Arm the wait before the navigation that triggers the fetch
    const {user, team} = await pw.initSetup();
    const {page, app} = await pw.testBrowser.login(user);
    // * Verify a posts request carried the hydration parameter. The wait is the assertion: it resolves on the first
    // matching response and fails the test on the timeout if none arrives. The initial channel load fetches unread
    // posts; only its property-group query variant proves hydration.
    await Promise.all([
        waitForApi(page, Api.GetPostsAroundLastUnread, {
            query: {propertyGroup: GROUP},
        }),
        app.teamPage.goto({team}),
    ]);
    await expect(app.center.composer).toBeVisible();
});

/**
 * @objective Verify the whole feature is inert when the flag is off: no hydration
 * parameter is sent and no chips are drawn.
 *
 * @precondition The PostAttributes feature flag is enabled server-side; this test turns
 * it off for one browser only.
 */
test('sends no parameter and draws no chips with the flag off', {tag: '@post_attributes'}, async ({pw}) => {
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field and set it, so the only reason no chip appears is the flag
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET'],
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'unflagged post'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {page, app} = await pw.testBrowser.login(user);

        // # Turn the flag off for this browser only. Patching the server config would
        // flip it for every spec running in parallel; rewriting the client config
        // response keeps the blast radius to this page.
        await page.route('**/api/v4/config/client?format=old', async (route) => {
            const response = await route.fetch();
            const config = await response.json();

            await route.fulfill({json: {...config, FeatureFlagPostAttributes: 'false'}});
        });

        const hydrationRequests = recordRequests(page, HYDRATION_PARAM);

        await app.channelsPage.goto({team, channel: channel.name});

        // * Verify the post rendered but carries no chip row
        const postOnScreen = app.center.postList.post(post);
        await expect(postOnScreen.container).toContainText('unflagged post');
        await expect(postOnScreen.attributes.container).toHaveCount(0);

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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, then set it on both a root post and its reply
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
        });
        created.push(classification);
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        // * Verify the chip is on the root in the centre channel
        const rootInCenter = app.center.postList.post(root);
        await expect(optionWithText(rootInCenter.attributes.value.selectText, 'SECRET')).toBeVisible();

        // # Open the thread in the RHS
        await rootInCenter.container.hover();
        await expect(rootInCenter.menu.replyButton).toBeVisible();
        await rootInCenter.menu.replyButton.click();
        await expect(app.rhs.postCreate).toBeVisible();

        // * Verify the same root carries its chip in the RHS. A value set on a reply has
        // never been gated to roots server-side, so gating it here would make it
        // permanently invisible.
        const rootInRhs = app.rhs.thread.post(root);
        await expect(optionWithText(rootInRhs.attributes.value.selectText, 'SECRET')).toBeVisible();

        // * Verify the reply carries its own, different chip
        const replyInRhs = app.rhs.thread.post(reply);
        await expect(optionWithText(replyInRhs.attributes.value.selectText, 'UNCLASSIFIED')).toBeVisible();
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision three ordered fields and set all three on one post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'three attributes'});
        await setPostValues(adminClient, post.id, [
            {field_id: first.id, value: optionId(first, 'SECRET')},
            {field_id: second.id, value: optionId(second, 'NOFORN')},
            {field_id: third.id, value: optionId(third, 'ORCON')},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        const postOnScreen = app.center.postList.post(post);

        // * Verify the first two fields drew chips, in sort_order
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'SECRET')).toBeVisible();
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'NOFORN')).toBeVisible();

        // * Verify the third became the badge rather than a third chip
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'ORCON')).toHaveCount(0);
        await expect(postOnScreen.attributes.overflowImg).toHaveText('+1');
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision two fields and set only one of them
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'one of two set'});
        await setPostValues(adminClient, post.id, [{field_id: set.id, value: optionId(set, 'SECRET')}]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        const postOnScreen = app.center.postList.post(post);

        // * Verify the set field drew its chip
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'SECRET')).toBeVisible();

        // * Verify the unset field drew nothing at all — no placeholder, and no slot
        // spent that would push a later attribute into the overflow badge
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'NOFORN')).toHaveCount(0);
        await expect(postOnScreen.attributes.overflowImg).toHaveCount(0);
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
    await pw.ensureFeatureFlag('PostAttributes', true);

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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: other.name});

        const postOnScreen = app.center.postList.post(post);

        // * Verify the post rendered without a chip row
        await expect(postOnScreen.container).toContainText('out of scope');
        await expect(postOnScreen.attributes.container).toHaveCount(0);

        // # Open the channel the field does belong to
        await app.channelsPage.goto({team, channel: owning.name});

        // * Verify the field applies there, so the absence above was scope and not a
        // broken fixture
        const inScope = await userClient.createTestPost({channel_id: owning.id, message: 'in scope'});
        await setPostValues(adminClient, inScope.id, [{field_id: scoped.id, value: optionId(scoped, 'SECRET')}]);

        const inScopeOnScreen = app.center.postList.post(inScope);
        await expect(optionWithText(inScopeOnScreen.attributes.value.selectText, 'SECRET')).toBeVisible();
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a field, set it, and open the channel
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: ['SECRET', 'UNCLASSIFIED'],
        });
        created.push(classification);
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'about to change'});
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'SECRET')},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        const postOnScreen = app.center.postList.post(post);
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'SECRET')).toBeVisible();

        // # Change the value from another session entirely
        await setPostValues(adminClient, post.id, [
            {field_id: classification.id, value: optionId(classification, 'UNCLASSIFIED')},
        ]);

        // * Verify the chip followed without a reload. This is why the row reads the
        // property values slice rather than the post's metadata: the websocket event
        // lands in that slice, and nothing re-delivers the post.
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'UNCLASSIFIED')).toBeVisible();
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'SECRET')).toHaveCount(0);
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one field of each type that draws exactly one chip
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        // * Verify a text field renders its stored string through the text renderer
        const textOnScreen = app.center.postList.post(textPost);
        const textChip = textOnScreen.attributes.value.textText;

        await expect(textChip).toHaveText('Q3 planning');

        // * Verify a select renders the option's name, never the stored option id
        const selectOnScreen = app.center.postList.post(selectPost);
        const selectChip = selectOnScreen.attributes.value.selectText;

        await expect(selectChip).toHaveText('SECRET');

        // * Verify the text value is drawn as the same chip as an option, in the same
        // neutral. Neither field carries a colour, so comparing the two against each
        // other pins them together without naming a value that changes with the theme.
        // Compare native computed styles of the two generated renderer elements.
        const neutralBackground = await selectChip.locator.evaluate(
            (el: Element) => getComputedStyle(el).backgroundColor,
        );

        await expect(textChip).toHaveCSS('background-color', neutralBackground);
        await expect(textChip).toHaveCSS(
            'border-radius',
            await selectChip.locator.evaluate((el: Element) => getComputedStyle(el).borderRadius),
        );
        await expect(textChip).toHaveCSS(
            'font-weight',
            await selectChip.locator.evaluate((el: Element) => getComputedStyle(el).fontWeight),
        );
        await expect(textChip).toHaveCSS(
            'padding',
            await selectChip.locator.evaluate((el: Element) => getComputedStyle(el).padding),
        );

        // * Verify a rank goes through that same option renderer and draws one chip
        const rankOnScreen = app.center.postList.post(rankPost);
        await expect(rankOnScreen.attributes.value.selectText).toHaveText('HIGH');

        // * Verify a user field resolves the id to a name. TeammateNameDisplay is
        // 'username' in the E2E config baseline, so that is what it resolves to.
        const userOnScreen = app.center.postList.post(userPost);
        const userChip = userOnScreen.attributes.value.user;

        await expect(userChip).toContainText(user.username);
        await expect(userChip).not.toContainText(user.id);

        // * Verify the chip carries the avatar beside the name. A user value is the one
        // chip that is not text alone, and the name assertion above would hold without it.
        // The library-rendered avatar has no separate part; inspect it within the generated user renderer.
        await expect(userChip.locator.locator('.Avatar')).toBeVisible();
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a multiselect and set two of its options on a post
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
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
        const post = await userClient.createTestPost({channel_id: channel.id, message: 'two caveats'});
        await setPostValues(adminClient, post.id, [
            {field_id: caveats.id, value: [optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]},
        ]);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        const postOnScreen = app.center.postList.post(post);

        // * Verify both entries drew their own chip, from the one field
        await expect(postOnScreen.attributes.value.selectText).toHaveCount(2);
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'NOFORN')).toBeVisible();
        await expect(optionWithText(postOnScreen.attributes.value.selectText, 'ORCON')).toBeVisible();

        // * Verify each chip took its own option's colour. Two different colours from one
        // field is what proves colour is resolved per option rather than per field.
        const noforn = optionWithText(postOnScreen.attributes.value.selectText, 'NOFORN');
        const orcon = optionWithText(postOnScreen.attributes.value.selectText, 'ORCON');

        await expect(noforn).toHaveCSS('background-color', RED_TOKEN.background);
        await expect(orcon).toHaveCSS('background-color', BLUE_TOKEN.background);
        await expect(noforn).toHaveCSS('color', DERIVED_FOREGROUND);
        await expect(orcon).toHaveCSS('color', DERIVED_FOREGROUND);

        // * Verify two entries exactly fill the budget, leaving nothing to overflow
        await expect(postOnScreen.attributes.overflowImg).toHaveCount(0);
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
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision one select carrying a palette colour, no colour, and a token nothing
    // recognises. The server stores options as opaque maps, so the third round-trips
    // exactly as written — which is the only way to reach the client's fallback for real.
    const {adminClient, user, userClient, team, townSquare: channel} = await pw.initSetup();
    const suffix = pw.random.id();
    const created: PropertyField[] = [];

    try {
        await purgeFields(adminClient);

        const classification = await createField(adminClient, fieldName('classification', suffix), {
            options: [{name: 'SECRET', color: RED_TOKEN.name}, 'PLAIN', {name: 'ODD', color: 'chartreuse'}],
        });
        created.push(classification);

        // # One post per option, so each draws a single chip
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});

        // * Verify the palette token resolves to its background and to a derived
        // foreground, both opaque, so the pair holds its contrast in any theme
        const colouredOnScreen = app.center.postList.post(colouredPost);
        const colouredChip = colouredOnScreen.attributes.value.selectText;

        await expect(colouredChip).toHaveCSS('background-color', RED_TOKEN.background);
        await expect(colouredChip).toHaveCSS('color', DERIVED_FOREGROUND);

        // * Verify an option with no colour still draws, in a translucent neutral. The
        // alpha channel is the tell: palette backgrounds are opaque hex, the neutral is a
        // theme token at 12%, so this holds whatever theme the account is on.
        const plainOnScreen = app.center.postList.post(plainPost);
        const plainChip = plainOnScreen.attributes.value.selectText;

        await expect(plainChip).toHaveText('PLAIN');
        await expect(plainChip).toHaveCSS('background-color', /^rgba\(/);

        // * Verify an unrecognised colour lands on that same neutral rather than being
        // passed through to CSS or dropping the chip
        // Read the generated renderer's native computed style to compare theme-dependent neutrals.
        const neutralBackground = await plainChip.locator.evaluate(
            (el: Element) => getComputedStyle(el).backgroundColor,
        );
        const oddOnScreen = app.center.postList.post(oddPost);
        const oddChip = oddOnScreen.attributes.value.selectText;

        await expect(oddChip).toHaveText('ODD');
        await expect(oddChip).toHaveCSS('background-color', neutralBackground);
    } finally {
        await deleteFields(adminClient, created);
    }
});
