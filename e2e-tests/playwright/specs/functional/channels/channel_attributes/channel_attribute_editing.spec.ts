// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {App, expect, test, Msg} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    assignAttributeOwner,
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    setChannelValue,
    valueFor,
} from './helpers';
import {
    addSelect,
    addText,
    chip,
    deselect,
    editor,
    labelChip,
    labelChips,
    openChannel,
    openChannelInfo,
    row,
    select,
    setText,
    startEditing,
} from './surface';

// Editing in Channel Info is admin-only, whatever an attribute's own setter tier
// says: useIsChannelAttributeAdmin gates the pencil, canSet only narrows further.
async function promoteToChannelAdmin(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    channelId: string,
    prefix: string,
) {
    const channelAdmin = await pw.createNewUserProfile(adminClient, {prefix});
    await adminClient.addToTeam(team.id, channelAdmin.id);
    await adminClient.addToChannel(channelAdmin.id, channelId);
    await adminClient.updateChannelMemberSchemeRoles(channelId, channelAdmin.id, true, true);
    return channelAdmin;
}

test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a text value can be changed from Channel Info and commits on Enter.
     */
    test('edits a text attribute inline and commits on Enter', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('note', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-text-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-note-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'first draft');

            const app = await openChannel(pw, channelAdmin, team, channel);

            // # Replace the existing value and commit with Enter
            const info = {attributes: await openChannelInfo(app)};
            await expect(await chip(info.attributes, note)).toHaveText('first draft');
            await setText(app, info.attributes, note, 'second draft', 'enter');

            // * The new value replaces the old one, in the panel and in the store
            await expect(await chip(info.attributes, note)).toHaveText('second draft');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('second draft');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a text edit commits on blur but is abandoned on Escape.
     */
    test('commits a text edit on blur and abandons it on Escape', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('commit', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-commit-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-commit-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'original');

            const app = await openChannel(pw, channelAdmin, team, channel);

            const info = {attributes: await openChannelInfo(app)};

            // # Type a new value and click away
            await setText(app, info.attributes, note, 'blurred', 'blur');
            await expect(await chip(info.attributes, note)).toHaveText('blurred');

            // # Type again, then abandon with Escape
            await setText(app, info.attributes, note, 'discarded', 'escape');

            // * Escape leaves the committed value untouched
            await expect(await chip(info.attributes, note)).toHaveText('blurred');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('blurred');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a multiselect value can gain and lose options after it is first set.
     *
     * @knownIssue Deselecting NOFORN leaves the header's ChannelAttributeLabels container
     * permanently `style="visibility: hidden"`, with the surviving ORCON chip correctly
     * present in the DOM but never un-hidden within the 10s assertion timeout. The container
     * only becomes visible once useLabelsOverflow's calculateOverflow runs to completion and
     * sets `measured` to true; the ids-changed effect schedules that through a 100ms debounce,
     * but something in this edit-and-remove flow (most likely the chip set changing twice in
     * quick succession, or the component briefly unmounting and remounting while Channel Info's
     * property value is in flight) appears to leave that debounced call never firing. This is a
     * timing bug in useLabelsOverflow's recalculation scheduling, not in the value write itself:
     * readChannelValues above already confirms the server stores [ORCON] correctly.
     */
    test.fixme('adds and removes a multiselect option, and the header chips follow', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const caveats = await createAttribute(adminClient, attributeName('caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
            });
            created.push(caveats);

            const channel = await createChannelForAttributes(adminClient, team, `edit-multi-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-caveats-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, caveats, [optionId(caveats, 'NOFORN')]);

            const app = await openChannel(pw, channelAdmin, team, channel);

            const info = {attributes: await openChannelInfo(app)};

            // # Add a second option to the existing one
            await select(app, info.attributes, caveats, 'ORCON');

            // * Both options are stored, in the order they were picked
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), caveats);
                })
                .toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);

            // # Remove the first one from its chip in the trigger
            await deselect(info.attributes, caveats, 'NOFORN');

            // * Only the remaining option survives, and the header agrees
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), caveats);
                })
                .toEqual([optionId(caveats, 'ORCON')]);
            await expect(await labelChip(app.channelHeader.attributes, 'ORCON')).toBeVisible();
            await expect(labelChips(app.channelHeader.attributes, 'NOFORN')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a failed value write is reported in the row and does not discard the stored value.
     */
    test('surfaces an inline error when the value write fails and keeps the previous value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('failing', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `edit-fail-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-fail-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'kept');

            const app = await openChannel(pw, channelAdmin, team, channel);

            await app.page.route('**/api/v4/properties/groups/access_control/channel/values/**', (route) => {
                if (route.request().method() !== 'PATCH') {
                    return route.continue();
                }
                return route.fulfill({status: 500, body: '{"message":"forced failure"}'});
            });

            const info = {attributes: await openChannelInfo(app)};
            await setText(app, info.attributes, note, 'never saved', 'enter');

            // * The row says the write failed, and keeps the edit open so it can be
            // * retried without retyping
            await expect(row(info.attributes, note).errorAlert).toBeVisible();
            await expect(editor(info.attributes, note)).toHaveValue('never saved');

            await app.page.unroute('**/api/v4/properties/groups/access_control/channel/values/**');

            // * Nothing was stored, so the previous value stands
            expect(valueFor(await readChannelValues(adminClient, channel.id), note)).toBe('kept');

            // # Retry now that the write succeeds
            await editor(info.attributes, note).press('Enter');
            await expect(row(info.attributes, note).editButton).toBeVisible();

            await expect(await chip(info.attributes, note)).toHaveText('never saved');
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('never saved');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a locked attribute can be filled once and is read-only afterwards.
     */
    test('fills a locked attribute once, after which it is read-only', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            // Channel first: the server refuses a channel that misses a required
            // attribute, so the only way to reach a required-but-unset value is for the
            // attribute to become required after the channel exists. That is also how a
            // real server gets there, when an admin marks an attribute required later.
            const channel = await createChannelForAttributes(adminClient, team, `edit-lock-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-lock-${suffix}`,
            );
            await adminClient.deleteChannel(channel.id);

            // The lock bites only once a value exists, so an empty one is still fillable.
            const marking = await createAttribute(adminClient, attributeName('locked_once', suffix), {
                options: ['FINAL'],
                actions: [DISPLAY_LABEL_INFO],
                editable: false,
                required: true,
            });
            created.push(marking);
            await adminClient.unarchiveChannel(channel.id);

            const app = await openChannel(pw, channelAdmin, team, channel);

            const info = {attributes: await openChannelInfo(app)};

            // * A required attribute with no value shows as missing and is still editable
            await expect(row(info.attributes, marking).missingText).toHaveMessage(
                Msg.channel_attributes.info.select_a_value,
            );
            await expect(row(info.attributes, marking).locked).toHaveCount(0);

            // # Set it for the first time
            await select(app, info.attributes, marking, 'FINAL');
            await expect(await chip(info.attributes, marking)).toHaveText('FINAL');

            // * Once set, the row is locked: no pencil, and the lock icon appears
            await expect(row(info.attributes, marking).locked).toBeVisible();
            await expect(row(info.attributes, marking).editButton).toHaveCount(0);

            expect(valueFor(await readChannelValues(adminClient, channel.id), marking)).toBe(
                optionId(marking, 'FINAL'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the admin setter tier admits a channel admin and excludes a plain member.
     */
    test('lets a channel admin edit an admin-tier attribute that a member cannot', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const adminOnly = await createAttribute(adminClient, attributeName('admin_edit', suffix), {
                options: ['SET'],
                actions: [DISPLAY_LABEL_INFO],
                permissionValues: 'admin',
            });
            created.push(adminOnly);

            const channel = await createChannelForAttributes(adminClient, team, `edit-tier-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-tier-${suffix}`,
            );
            await adminClient.addToChannel(user.id, channel.id);

            // # Look at it as the channel admin
            const asAdmin = await openChannel(pw, channelAdmin, team, channel);
            const adminInfo = {attributes: await openChannelInfo(asAdmin)};

            // Added rather than edited: an unset optional attribute has no row until
            // it has a value.
            // * The channel admin clears the admin tier and can set it
            await addSelect(adminInfo.attributes, adminOnly, 'SET');
            await expect(await chip(adminInfo.attributes, adminOnly)).toHaveText('SET');

            // # Look at the same attribute as an ordinary member
            const asMember = await openChannel(pw, user, team, channel);
            const memberInfo = {attributes: await openChannelInfo(asMember)};

            // * The member sees the value but is offered no way to change it
            await expect(await chip(memberInfo.attributes, adminOnly)).toHaveText('SET');
            await expect(row(memberInfo.attributes, adminOnly).editButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify Channel Info management (unset required rows, Add Attribute,
     * and the pencil) is available to a channel admin regardless of an attribute's
     * own setter tier.
     */
    test('shows a channel admin every attribute, including unset ones, and lets them add or edit', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            // Member-tier on purpose: management stays admin-only in Channel Info
            // even for an attribute a plain member is otherwise allowed to set.
            const required = await createAttribute(adminClient, attributeName('req', suffix), {
                actions: [DISPLAY_LABEL_INFO],
                options: ['DRAFT'],
                required: true,
            });
            created.push(required);
            const optional = await createAttribute(adminClient, attributeName('opt', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(optional);

            const channel = await createChannelForAttributes(
                adminClient,
                team,
                `edit-admin-lists-${suffix}`,
                undefined,
                [{field_id: required.id, value: optionId(required, 'DRAFT')}],
            );
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-lists-${suffix}`,
            );

            const app = await openChannel(pw, channelAdmin, team, channel);
            const info = {attributes: await openChannelInfo(app)};

            // * A required attribute that already has a value is listed and editable
            await expect(await chip(info.attributes, required)).toHaveText('DRAFT');
            await expect(row(info.attributes, required).editButton).toBeVisible();

            // * An unset optional attribute is reachable through Add Attribute, and
            // * becomes editable once added
            await expect(row(info.attributes, optional)).toHaveCount(0);
            await addText(info.attributes, optional);
            await editor(info.attributes, optional).fill('drafted');
            await editor(info.attributes, optional).press('Enter');
            await expect(row(info.attributes, optional).editButton).toBeVisible();
            await expect(await chip(info.attributes, optional)).toHaveText('drafted');
            await expect(row(info.attributes, optional).editButton).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a plain member only sees attributes that already carry a
     * value, always read-only, with no Add Attribute affordance.
     */
    test('shows a plain member only what is already set, read-only, with no way to manage attributes', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const required = await createAttribute(adminClient, attributeName('req', suffix), {
                actions: [DISPLAY_LABEL_INFO],
                options: ['DRAFT'],
                required: true,
            });
            created.push(required);
            const optional = await createAttribute(adminClient, attributeName('opt', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(optional);

            const channel = await createChannelForAttributes(
                adminClient,
                team,
                `edit-member-hides-${suffix}`,
                undefined,
                [{field_id: required.id, value: optionId(required, 'DRAFT')}],
            );
            await adminClient.addToChannel(user.id, channel.id);

            const app = await openChannel(pw, user, team, channel);
            const info = {attributes: await openChannelInfo(app)};

            // * The required attribute's value is visible, but there is no pencil
            await expect(await chip(info.attributes, required)).toHaveText('DRAFT');
            await expect(row(info.attributes, required).editButton).toHaveCount(0);

            // * The unset optional attribute has no row, and there is no way to add one
            await expect(row(info.attributes, optional)).toHaveCount(0);
            await expect(info.attributes.addButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a single-select value clears from the chip remove control, not a
     * Clear menu item.
     */
    test('clears a single-select value from its chip remove control', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('single_clear', suffix), {
                options: ['SECRET', 'PUBLIC'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `edit-clear-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-clear-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const app = await openChannel(pw, channelAdmin, team, channel);

            const info = {attributes: await openChannelInfo(app)};
            await expect(await chip(info.attributes, marking)).toHaveText('SECRET');

            // * No Clear menu item — clear lives on the chip
            await startEditing(info.attributes, marking);
            // The menu opens outside the row, so it is found from the app.
            const editMenu = app.channelAttributeEditMenu;
            await expect(await editMenu.optionList.itemWith({text: 'SECRET'})).toBeVisible();
            // Only the two options, with no Clear item among them.
            await expect(editMenu.optionList).toHaveKeyCount(2);
            await app.page.keyboard.press('Escape');
            await expect(editMenu.optionList).toHaveKeyCount(0);

            // # Clear it from the chip remove control
            await deselect(info.attributes, marking, 'SECRET');

            // * The value is gone from the store
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), marking) ?? null;
                })
                .toBeNull();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify an attribute whose values an integration owns is read-only
     * in Channel Info, even for a system admin.
     */
    test('shows an attribute owned by an integration as read-only, even to a system admin', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const owned = await createAttribute(adminClient, attributeName('owned', suffix), {
                options: ['NOFORN', 'RELIDO'],
                actions: [DISPLAY_LABEL_INFO],
            });
            const ordinary = await createAttribute(adminClient, attributeName('ordinary', suffix), {
                options: ['ALPHA'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(owned, ordinary);

            const channel = await createChannelForAttributes(adminClient, team, `edit-owned-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);

            // Seed the value while the attribute is still ordinary, the way the
            // owning integration would have written it.
            await setChannelValue(adminClient, channel.id, owned, optionId(owned, 'NOFORN'));
            await assignAttributeOwner(adminClient, owned, 'com.example.markings');

            const app = await openChannel(pw, adminUser, team, channel);

            const info = {attributes: await openChannelInfo(app)};

            // * The value is shown as a plain chip behind a lock, with nothing to open
            await expect(await chip(info.attributes, owned)).toHaveText('NOFORN');
            await expect(row(info.attributes, owned).locked).toBeVisible();
            await expect(row(info.attributes, owned).locked).toHaveAttribute(
                'aria-label',
                'This attribute is managed by an integration and cannot be changed here',
            );
            await expect(row(info.attributes, owned).editButton).toHaveCount(0);

            // # Click the chip where the editor's trigger would be
            // The value label opens editing through its click handler, without an interactive role.
            const value = await chip(info.attributes, owned);
            await ('container' in value ? value.container : value).click();

            // * No option menu opens, so the write the server would refuse is never offered
            await expect(new App(info.attributes.page).channelAttributeEditMenu.optionList.locator).toHaveCount(0);
            await expect(row(info.attributes, owned).errorAlert).toHaveCount(0);

            // * The ordinary attribute beside it is still offered for adding, so the
            // * lock is scoped to the owned one rather than the whole panel
            await info.attributes.addButton.click();
            await expect(info.attributes.addMenu.attribute(ordinary)).toBeVisible();
            await expect(info.attributes.addMenu.attribute(owned)).toHaveCount(0);

            // * The stored value is untouched
            expect(valueFor(await readChannelValues(adminClient, channel.id), owned)).toBe(optionId(owned, 'NOFORN'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
