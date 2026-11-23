// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    FIELD_PREFIX,
    GROUP,
    OBJECT_TYPE,
    VALUES_ROUTE,
    addMember,
    fieldName,
    modalRow,
    modalTrigger,
    openModalFromPostMenu,
    optionId,
    pickerItem,
    purgeFields,
} from './support';

const CHIPS = 'post-attributes-chips';
const OPTION_CHIP = 'select-property';
const MODAL = '#postAttributesModal';

// The padlock's accessible name, the only thing that tells a locked row from an open one.
const LOCKED_REASON = "You don't have permission to modify this attribute.";

// Fields are created through the System Console, so the spec cannot hold them: it sweeps
// everything carrying the suite's prefix, linked post fields first and then the template,
// so the 50-field post cap and the group's 200-field limit are never reached across runs.
test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await purgeFields(adminClient);
});

/**
 * @objective Verify an attribute created from the System Console with Applies to = Posts
 * gives its post field the `creator` value level, so the post's author and an admin of its
 * channel can set the value and another member cannot.
 *
 * The attribute is made in the console, not through the API, so what is tested is the
 * payload the console sends.
 *
 * @precondition The PostAttributes feature flag is enabled, and the server has an
 * Enterprise-level licence (Entry counts).
 */
test(
    'lets the author and a channel admin set a console-created post field, not another member',
    {tag: '@post_attributes'},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, adminUser, user: author, userClient: authorClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const name = fieldName('creator', suffix);

        await purgeFields(adminClient);

        // # Create a select attribute with two options, applying to posts only, in the console
        const admin = await pw.testBrowser.login(adminUser);
        await admin.page.goto('/admin_console/system_attributes/manage_attributes');
        await admin.page.getByTestId('newAttributeButton').click();
        await admin.page.getByTestId('attributeDisplayNameInput').fill(name);
        await admin.page.getByTestId('attributeTypeMenuButton').click();
        await admin.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
        await admin.page.getByTestId('attributeOptionsValues__addInput').fill('Alpha');
        await admin.page.getByTestId('attributeOptionsValues__addInput').press('Enter');
        await admin.page.getByTestId('attributeOptionsValues__addInput').fill('Bravo');
        await admin.page.getByTestId('attributeOptionsValues__addInput').press('Enter');
        await admin.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
        await admin.page.getByRole('menuitem', {name: 'Posts'}).click();

        const postFieldCreated = admin.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname.endsWith(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields`),
        );
        await admin.page.getByTestId('saveSetting').click();

        // * Verify the console created the linked post field with the `creator` level, from
        // the response and from a fetch of what is stored
        const created = await (await postFieldCreated).json();
        expect(created.name).toBe(name);
        expect(created.permission_values).toBe('creator');

        const fields = await adminClient.getPropertyFields(GROUP, OBJECT_TYPE, {targetType: 'system'});
        const field = (fields ?? []).find((candidate: PropertyField) => candidate.name === name)!;
        expect(field).toBeTruthy();
        expect(field.name.startsWith(FIELD_PREFIX)).toBe(true);
        expect(field.permission_values).toBe('creator');
        expect(field.linked_field_id).toBeTruthy();

        // # A channel with the author, a plain member B and a channel admin C, and a post by the author
        const channel = await adminClient.createPublicChannel(team.id, `creator-${suffix}`);
        await adminClient.addToChannel(author.id, channel.id);
        const {user: userB, client: clientB} = await addMember(pw, adminClient, team, [channel.id]);
        const {user: userC} = await addMember(pw, adminClient, team, [channel.id], {
            channelAdmin: true,
        });
        const post = await authorClient.createTestPost({channel_id: channel.id, message: `by the author ${suffix}`});

        // # The author opens the modal, adds the field and picks Alpha
        const a = await pw.testBrowser.login(author);
        await a.channelsPage.goto(team.name, channel.name);
        await a.channelsPage.toBeVisible();

        const postForA = await a.channelsPage.centerView.getPostById(post.id);
        await openModalFromPostMenu(a.channelsPage, postForA);
        await expect(a.page.locator(MODAL)).toBeVisible();
        await a.page.getByTestId('post-attributes-add').click();
        await pickerItem(a.page, field).click();
        await modalTrigger(a.page, field).click();

        const written = a.page.waitForResponse(
            (response) =>
                response.url().includes(`${VALUES_ROUTE}${post.id}`) && response.request().method() === 'PATCH',
        );
        await a.page.getByRole('menuitemradio', {name: 'Alpha', exact: true}).click();

        // * Verify the author's write was accepted and the chip is on the post
        expect((await written).status()).toBe(200);
        await expect(postForA.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('Alpha');

        // # B, a plain member, opens the modal on the author's post
        const b = await pw.testBrowser.login(userB);
        await b.channelsPage.goto(team.name, channel.name);
        await b.channelsPage.toBeVisible();

        const postForB = await b.channelsPage.centerView.getPostById(post.id);
        await expect(postForB.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('Alpha');
        await openModalFromPostMenu(b.channelsPage, postForB);
        await expect(b.page.locator(MODAL)).toBeVisible();

        // * Verify B sees the value as text with a padlock and no way in
        const rowForB = modalRow(b.page, field);
        await expect(rowForB).toContainText('Alpha');
        await expect(rowForB.getByRole('img', {name: LOCKED_REASON})).toBeVisible();
        await expect(modalTrigger(b.page, field)).toHaveCount(0);

        // * Verify a direct write by B is refused
        const refused = await clientB
            .patchPropertyValues(GROUP, OBJECT_TYPE, post.id, [{field_id: field.id, value: optionId(field, 'Bravo')}])
            .then(
                () => 200,
                (error: {status_code?: number}) => error.status_code,
            );
        expect(refused).toBe(403);

        // # C, an admin of the channel, opens the modal and picks Bravo
        const c = await pw.testBrowser.login(userC);
        await c.channelsPage.goto(team.name, channel.name);
        await c.channelsPage.toBeVisible();

        const postForC = await c.channelsPage.centerView.getPostById(post.id);
        await openModalFromPostMenu(c.channelsPage, postForC);
        await expect(c.page.locator(MODAL)).toBeVisible();

        // * Verify C's row is open
        await expect(modalRow(c.page, field).getByRole('img', {name: LOCKED_REASON})).toHaveCount(0);
        await modalTrigger(c.page, field).click();

        const writtenByC = c.page.waitForResponse(
            (response) =>
                response.url().includes(`${VALUES_ROUTE}${post.id}`) && response.request().method() === 'PATCH',
        );
        await c.page.getByRole('menuitemradio', {name: 'Bravo', exact: true}).click();

        // * Verify the admin's write was accepted and the chip follows
        expect((await writtenByC).status()).toBe(200);
        await expect(postForC.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('Bravo');

        // * Verify the same change reached the author without a reload
        await expect(postForA.container.getByTestId(CHIPS).getByTestId(OPTION_CHIP)).toHaveText('Bravo');
    },
);
