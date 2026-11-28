// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {
    FIELD_PREFIX,
    GROUP,
    OBJECT_TYPE,
    addMember,
    fieldName,
    openModalFromPostMenu,
    optionId,
    purgeFields,
    skipIfNoPostAttributesLicense,
} from './support';

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
        await skipIfNoPostAttributesLicense();
        await pw.ensureFeatureFlag('PostAttributes', true);

        const {adminClient, adminUser, user: author, userClient: authorClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const name = fieldName('creator', suffix);

        await purgeFields(adminClient);

        // # Create a select attribute with two options, applying to posts only, in the console
        const {app: admin} = await pw.testBrowser.login(adminUser);
        await admin.page.goto('/admin_console/system_attributes/manage_attributes');
        const form = admin.admin.attribute;
        await admin.admin.attributes.newButton.clickTo(form.displayName.container);
        await form.displayName.container.fill(name);
        await expect(form.displayName.container).toHaveValue(name);

        // The options editor is drawn only once the type takes options, so its input showing is the type changing
        await form.type.container.clickTo(form.type.option('select'));
        await form.type.option('select').clickTo(form.values.addTextbox);

        await form.values.addTextbox.fill('Alpha');
        await form.values.addTextbox.press('Enter');
        await expect(form.values.option(0).labelText).toHaveText('Alpha');
        await form.values.addTextbox.fill('Bravo');
        await form.values.addTextbox.press('Enter');
        await expect(form.values.option(1).labelText).toHaveText('Bravo');

        await form.appliesTo.add.container.clickTo(form.appliesTo.add.resource('post'));
        await form.appliesTo.add.resource('post').clickTo(form.appliesTo.post);

        // * Verify the console created the linked post field with the `creator` level, from
        // the response and from a fetch of what is stored
        const created = await settle(admin.admin.saveButton, {
            wait: Api.CreatePropertyField,
            params: {group_name: GROUP, object_type: OBJECT_TYPE},
        }).click();
        expect(created.name).toBe(name);
        expect(created.permission_values).toBe('creator');

        const fields = await adminClient.getPropertyFields(GROUP, OBJECT_TYPE, {targetType: 'system'});
        const found = (fields ?? []).find((candidate: PropertyField) => candidate.name === name);
        expect(found).toBeTruthy();
        if (!found) {
            throw new Error(`post field ${name} not found`);
        }
        const field = found;
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

        // The PATCH a pick in the modal sends for this post
        const valuesWrite = {
            wait: Api.UpdatePropertyValues,
            params: {group_name: GROUP, object_type: OBJECT_TYPE, target_id: post.id},
            status: 200,
        };

        // # The author opens the modal, adds the field and picks Alpha
        const {app: a} = await pw.testBrowser.login(author);
        await a.channelsPage.goto({team, channel});

        const postForA = a.center.postList.post(post);
        const modalForA = await openModalFromPostMenu(a, postForA);
        await expect(modalForA).toBeVisible();
        await modalForA.addButton.clickTo(modalForA.addMenu);
        await modalForA.addMenu.field(field).clickTo(modalForA.attribute(field));
        await modalForA.attribute(field).valueButton.clickTo(modalForA.attribute(field).valueMenu);

        // * Verify the author's write was accepted and the chip is on the post
        await settle(modalForA.attribute(field).valueMenu.option(optionId(field, 'Alpha')), valuesWrite).click();
        await expect(postForA.attributes.value.selectText).toHaveText('Alpha');

        // # B, a plain member, opens the modal on the author's post
        const {app: b} = await pw.testBrowser.login(userB);
        await b.channelsPage.goto({team, channel});

        const postForB = b.center.postList.post(post);
        await expect(postForB.attributes.value.selectText).toHaveText('Alpha');
        const modalForB = await openModalFromPostMenu(b, postForB);
        await expect(modalForB).toBeVisible();

        // * Verify B sees the value as text with a padlock and no way in
        const rowForB = modalForB.attribute(field);
        await expect(rowForB.container).toContainText('Alpha');
        await expect(rowForB.lockedImg).toBeVisible();
        await expect(rowForB.lockedImg.locator).toHaveAccessibleName(LOCKED_REASON);
        await expect(rowForB.valueButton).toHaveCount(0);

        // * Verify a direct write by B is refused
        const refused = await clientB
            .patchPropertyValues(GROUP, OBJECT_TYPE, post.id, [{field_id: field.id, value: optionId(field, 'Bravo')}])
            .then(
                () => 200,
                (error: {status_code?: number}) => error.status_code,
            );
        expect(refused).toBe(403);

        // # C, an admin of the channel, opens the modal and picks Bravo
        const {app: c} = await pw.testBrowser.login(userC);
        await c.channelsPage.goto({team, channel});

        const postForC = c.center.postList.post(post);
        const modalForC = await openModalFromPostMenu(c, postForC);
        await expect(modalForC).toBeVisible();

        // * Verify C's row is open
        await expect(modalForC.attribute(field).lockedImg).toHaveCount(0);
        await modalForC.attribute(field).valueButton.clickTo(modalForC.attribute(field).valueMenu);

        // * Verify the admin's write was accepted and the chip follows
        await settle(modalForC.attribute(field).valueMenu.option(optionId(field, 'Bravo')), valuesWrite).click();
        await expect(postForC.attributes.value.selectText).toHaveText('Bravo');

        // * Verify the same change reached the author without a reload
        await expect(postForA.attributes.value.selectText).toHaveText('Bravo');
    },
);
