// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    HYDRATION_PARAM,
    OBJECT_TYPE,
    addMember,
    createLinkedPostField,
    createHolderField,
    createPostWithValues,
    createTemplate,
    deleteTemplateSet,
    fieldName,
    maskTemplateBy,
    openModalFromPostMenu,
    optionId,
    purgeFields,
    setHolding,
    skipIfNoPostAttributesLicense,
} from './support';

// What a test made, so the afterEach below can delete it. Reset before every test.
let made: {posts: PropertyField[]; holders: PropertyField[]; templates: PropertyField[]};

test.beforeEach(() => {
    made = {posts: [], holders: [], templates: []};
});

// Deletes in the order the server allows (linked fields before their template), so the
// 50-field post cap and the group's 200-field limit are never reached across runs.
test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await deleteTemplateSet(adminClient, made);
});

/**
 * @objective Verify a post field linked to a template, created through the API the way the
 * Global Attributes admin page creates it, takes the template's options, accepts a value
 * from the edit modal, and draws the chip.
 *
 * @precondition The PostAttributes feature flag is enabled, and the server has an
 * Enterprise-level licence (Entry counts).
 */
test('sets a value on a template-linked post field from the edit modal', {tag: '@post_attributes'}, async ({pw}) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a template and a system post field linked to it
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();

    await purgeFields(adminClient);

    const template = await createTemplate(adminClient, fieldName('tpl', suffix), ['SECRET', 'UNCLASSIFIED']);
    made.templates.push(template);

    const linked = await createLinkedPostField(adminClient, template, fieldName('level', suffix), {
        visibility: 'always',
    });
    made.posts.push(linked);

    // * Verify the field is in access_control, linked, system-scoped, and carries the
    // template's options
    expect(linked.group_id).toBe(template.group_id);
    expect(linked.linked_field_id).toBe(template.id);
    expect(linked.object_type).toBe(OBJECT_TYPE);
    expect(linked.target_type).toBe('system');
    expect(optionId(linked, 'SECRET')).toBeTruthy();
    expect(template.object_type).toBe('template');

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const post = await userClient.createTestPost({channel_id: channel.id, message: 'from a template'});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const postOnScreen = app.center.postList.post(post);

    // * Verify the post starts with no chip, so the chip below comes from the write
    await expect(postOnScreen.container).toContainText('from a template');
    await expect(postOnScreen.attributes.container).toHaveCount(0);

    // # Open the modal and pick an option on the linked field's row
    const modal = await openModalFromPostMenu(app, postOnScreen);
    await expect(modal).toBeVisible();
    await expect(modal.attribute(linked).container).toBeVisible();
    await modal.attribute(linked).valueButton.clickTo(modal.attribute(linked).valueMenu);

    // # Wait on the write itself rather than on elapsed time
    // * Verify the write succeeded and the chip is on the post behind the modal
    await settle(modal.attribute(linked).valueMenu.option(optionId(linked, 'SECRET')), {
        wait: Api.UpdatePropertyValues,
        params: {group_name: GROUP, object_type: OBJECT_TYPE, target_id: post.id},
        status: 200,
    }).click();
    await expect(postOnScreen.attributes.value.selectText).toHaveText('SECRET');
});

/**
 * @objective Verify a template that masks by a user attribute shows a post's value only to
 * a viewer holding that option: A holds it and sees the chip, B does not and sees none, and
 * the visibility follows each user's holdings after a reload.
 *
 * @precondition The PostAttributes feature flag and PropertyFieldPermissionsV3 are enabled,
 * and the server has an Enterprise-level licence (Entry counts).
 */
test('shows a masked value only to the user who holds it', {tag: '@post_attributes'}, async ({pw}, testInfo) => {
    await skipIfNoPostAttributesLicense();
    await pw.ensureFeatureFlag('PostAttributes', true);

    // # Provision a template, a holder user field and a post field, all linked, then turn
    // masking on
    const {adminClient, user: userA, userClient, team} = await pw.initSetup();
    const suffix = pw.random.id();

    await purgeFields(adminClient);

    const template = await createTemplate(adminClient, fieldName('mask', suffix), ['Alpha', 'Bravo']);
    made.templates.push(template);

    const holder = await createHolderField(adminClient, fieldName('holder', suffix), template);
    made.holders.push(holder);

    const postField = await createLinkedPostField(adminClient, template, fieldName('masked', suffix), {
        visibility: 'always',
    });
    made.posts.push(postField);

    const masked = await maskTemplateBy(adminClient, template, holder);
    expect(
        (masked as unknown as {permissions?: {masking?: {mask_by_field_id?: string}}}).permissions?.masking
            ?.mask_by_field_id,
    ).toBe(holder.id);

    // # Two users on the same channel; only A holds Alpha
    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {user: userB} = await addMember(pw, adminClient, team, [channel.id]);
    await setHolding(adminClient, userA.id, holder, optionId(holder, 'Alpha'));

    // # A posts with the linked field set to Alpha
    const post = await createPostWithValues(userClient, channel.id, `masked ${suffix}`, [
        {field_id: postField.id, value: optionId(postField, 'Alpha')},
    ]);

    const a = await pw.testBrowser.login(userA);
    const b = await pw.testBrowser.login(userB);

    const alphaId = optionId(postField, 'Alpha');

    // Opens the channel and returns the post's chip row and the values the server hydrated
    // onto it. The no-chip assertions are only meaningful if the attribute data arrived, so
    // both requests are waited for and checked, not just matched by URL: a failed request
    // would also leave the chip row empty.
    const open = async (session: typeof a) => {
        // Arm before navigating, since the requests that matter are the ones the channel load
        // makes
        const hydrated = session.page.waitForResponse((response) => response.url().includes(HYDRATION_PARAM));
        const fieldsLoaded = session.page.waitForResponse((response) =>
            response.url().includes(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields`),
        );

        await session.app.channelsPage.goto({team, channel});
        const [hydratedResponse, fieldsResponse] = await Promise.all([hydrated, fieldsLoaded]);

        // * Verify both requests succeeded and the post field's definition arrived
        expect(hydratedResponse.ok()).toBe(true);
        expect(fieldsResponse.ok()).toBe(true);
        const fields = (await fieldsResponse.json()) as PropertyField[];
        expect(fields.map((field) => field.id)).toContain(postField.id);

        // * Verify the hydrated response carries the post, so an empty value list means the
        // value was withheld and not that the post was missing
        const hydratedPost = (await hydratedResponse.json()).posts?.[post.id];
        expect(hydratedPost).toBeDefined();
        expect(hydratedPost.metadata.property_values_unavailable).toBe(false);
        const values = (hydratedPost.metadata.property_values ?? []) as Array<{value: unknown}>;

        const onScreen = session.app.center.postList.post(post);
        await expect(onScreen.container).toContainText(`masked ${suffix}`);
        return {chips: onScreen.attributes, values: values.map((entry) => entry.value)};
    };

    // * Verify A, who holds Alpha, is sent the value and sees the chip
    const openedA = await open(a);
    expect(openedA.values).toContain(alphaId);
    await expect(openedA.chips.value.selectText).toHaveText('Alpha');
    await testInfo.attach('user-a-sees-chip', {body: await a.page.screenshot(), contentType: 'image/png'});

    // * Verify B, who holds nothing, sees the post, is not sent the value and sees no chip
    const openedB = await open(b);
    expect(openedB.values).not.toContain(alphaId);
    await expect(openedB.chips.container).toHaveCount(0);
    await testInfo.attach('user-b-no-chip', {body: await b.page.screenshot(), contentType: 'image/png'});

    // # B is given Alpha and A is moved to Bravo, then both reload
    await setHolding(adminClient, userB.id, holder, optionId(holder, 'Alpha'));
    await setHolding(adminClient, userA.id, holder, optionId(holder, 'Bravo'));
    await a.page.reload();
    await b.page.reload();

    // * Verify the chip followed the holdings: B sees it now, A no longer does
    const openedBAfter = await open(b);
    expect(openedBAfter.values).toContain(alphaId);
    await expect(openedBAfter.chips.value.selectText).toHaveText('Alpha');

    const openedAAfter = await open(a);
    expect(openedAAfter.values).not.toContain(alphaId);
    await expect(openedAAfter.chips.container).toHaveCount(0);
});
