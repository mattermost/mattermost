// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    OBJECT_TYPE,
    VALUES_ROUTE,
    addMember,
    createLinkedPostField,
    createHolderField,
    createPostWithValues,
    createTemplate,
    deleteTemplateSet,
    fieldName,
    maskTemplateBy,
    modalRow,
    modalTrigger,
    openModalFromPostMenu,
    optionId,
    purgeFields,
    setHolding,
} from './support';

const CHIPS = 'post-attributes-chips';
const OPTION_CHIP = 'select-property';

// `GenericModal` renders `role='none'`, so the element id it forwards is the only stable
// handle on the modal itself.
const MODAL = '#postAttributesModal';

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
    await pw.skipIfNoLicense();
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

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const postOnScreen = await channelsPage.centerView.getPostById(post.id);

    // * Verify the post starts with no chip, so the chip below comes from the write
    await expect(postOnScreen.container).toContainText('from a template');
    await expect(postOnScreen.container.getByTestId(CHIPS)).toHaveCount(0);

    // # Open the modal and pick an option on the linked field's row
    await openModalFromPostMenu(channelsPage, postOnScreen);
    await expect(page.locator(MODAL)).toBeVisible();
    await expect(modalRow(page, linked)).toBeVisible();
    await modalTrigger(page, linked).click();

    // # Wait on the write itself rather than on elapsed time
    const written = page.waitForResponse(
        (response) => response.url().includes(`${VALUES_ROUTE}${post.id}`) && response.request().method() === 'PATCH',
    );
    await page.getByRole('menuitemradio', {name: 'SECRET', exact: true}).click();

    // * Verify the write succeeded and the chip is on the post behind the modal
    expect((await written).status()).toBe(200);
    await expect(postOnScreen.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('SECRET');
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
    await pw.skipIfNoLicense();
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

    const open = async (session: typeof a) => {
        await session.channelsPage.goto(team.name, channel.name);
        await session.channelsPage.toBeVisible();
        const onScreen = await session.channelsPage.centerView.getPostById(post.id);
        await expect(onScreen.container).toContainText(`masked ${suffix}`);
        return onScreen.container.getByTestId(CHIPS);
    };

    // * Verify A, who holds Alpha, sees the chip
    const chipsA = await open(a);
    await expect(chipsA.getByTestId(OPTION_CHIP)).toHaveText('Alpha');
    await testInfo.attach('user-a-sees-chip', {body: await a.page.screenshot(), contentType: 'image/png'});

    // * Verify B, who holds nothing, sees the post and no chip
    const chipsB = await open(b);
    await expect(chipsB).toHaveCount(0);
    await testInfo.attach('user-b-no-chip', {body: await b.page.screenshot(), contentType: 'image/png'});

    // # B is given Alpha and A is moved to Bravo, then both reload
    await setHolding(adminClient, userB.id, holder, optionId(holder, 'Alpha'));
    await setHolding(adminClient, userA.id, holder, optionId(holder, 'Bravo'));
    await a.page.reload();
    await b.page.reload();

    // * Verify the chip followed the holdings: B sees it now, A no longer does
    const chipsBAfter = await open(b);
    await expect(chipsBAfter.getByTestId(OPTION_CHIP)).toHaveText('Alpha');

    const chipsAAfter = await open(a);
    await expect(chipsAAfter).toHaveCount(0);
});
