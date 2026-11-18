// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {
    Api,
    settle,
    chipSwatch,
    comboboxChips,
    comboboxSwatches,
    expect,
    test,
    DefaultChannel,
} from '@mattermost/playwright-lib';

import {
    assertNoForeignRequiredAttributes,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    trackChannelCreates,
    valueFor,
} from './helpers';
import {openAttributeControl, openChannel, openNewChannelModal, pickListOption} from './surface';

test.describe('Channel attribute assignment', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    // required: true below needs the kill switch on; the server refuses to mark any
    // field required while it is off (model.IsChannelAttributesRequiredEnabled).

    /**
     * @objective Verify every supported attribute control can be assigned while creating a channel.
     */
    test('assigns select, multiselect, and text attribute values at channel creation', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // Required, because the create dialog asks only for required attributes.
            const program = await createAttribute(adminClient, attributeName('program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            const caveats = await createAttribute(adminClient, attributeName('caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                required: true,
            });
            const note = await createAttribute(adminClient, attributeName('note', suffix), {
                type: 'text',
                required: true,
            });
            const userScoped = await createAttribute(adminClient, attributeName('clearance', suffix), {
                objectType: 'user',
                options: ['SECRET'],
                required: true,
            });
            created.push(program, caveats, note, userScoped);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            const attribute = (field: {id: string}) => modal.attributes.attribute(field);

            const openControl = (field: {id: string}) => openAttributeControl(modal, field);

            // Only the channel-scoped attributes belong here; a user attribute in
            // the same group must not leak into channel creation.
            await expect(attribute(program)).toBeVisible();
            await expect(attribute(caveats)).toBeVisible();
            await expect(attribute(note)).toBeVisible();
            await expect(attribute(userScoped)).toHaveCount(0);

            const displayName = `Attr Channel ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);

            await openControl(program);
            await pickListOption(app, 'AURORA');

            // The menu closes on each pick, so a multiselect needs reopening to
            // add the second value. Two values is what proves the array shape.
            await openControl(caveats);
            await pickListOption(app, 'NOFORN');
            await openControl(caveats);
            await pickListOption(app, 'ORCON');

            await attribute(note).valueInput.container.fill('handle with care');

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();

            // The values ride the create request, so the modal closing means the
            // channel and its values both landed. The channel header is already
            // visible from before, so waiting on it proves nothing.
            await expect(modal).not.toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            const values = await readChannelValues(adminClient, channel.id);

            expect(valueFor(values, program)).toBe(optionId(program, 'AURORA'));
            expect(valueFor(values, caveats)).toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);
            expect(valueFor(values, note)).toBe('handle with care');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify attribute assignment works for a private channel, not only a public one.
     */
    test('assigns attribute values when creating a private channel', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('private_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            created.push(program);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            const openControl = (field: {id: string}) => openAttributeControl(modal, field);

            const displayName = `Attr Private ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);
            await modal.type.privateButton.click();
            await expect(modal.type.privateButton).toHaveClass(/\bselected\b/);

            await openControl(program);
            await pickListOption(app, 'BOREALIS');

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(channel.type).toBe('P');

            const values = await readChannelValues(adminClient, channel.id);
            expect(valueFor(values, program)).toBe(optionId(program, 'BOREALIS'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the server refuses a channel that is missing a required value.
     */
    test('rejects a create that omits a required attribute', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('required_api', suffix), {
                options: ['AURORA'],
                required: true,
            });
            created.push(program);

            // Straight at the API, which is the point: the requirement holds for
            // callers that never see the create dialog.
            const name = `attr-api-${suffix}`;
            await expect(
                adminClient.createChannel({
                    team_id: team.id,
                    name,
                    display_name: `Attr API ${suffix}`,
                    type: 'O',
                }),
            ).rejects.toThrow();

            await expect(adminClient.getChannelByName(team.id, name)).rejects.toThrow();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify picking an option with the keyboard and closing the menu with Escape never confirm or close the create dialog.
     */
    test('keeps the modal open while picking an option with the keyboard and closing the menu with Escape', async ({
        pw,
    }) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('kbd_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            created.push(program);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const createCount = trackChannelCreates(app.page);
            const modal = await openNewChannelModal(app);
            const displayName = `Attr Keyboard ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);
            const attribute = modal.attributes.attribute(program);
            const combobox = attribute.valueChoiceCombobox.locator;

            // # Complete the form
            await modal.attributes.attribute(program).valueChoiceCombobox.choose('AURORA');
            await expect(modal.attributes.attribute(program).valueChoiceCombobox).toHaveValue('AURORA');

            // # Open the menu and press Escape
            await openAttributeControl(modal, program);
            await combobox.press('Escape');

            // * Only the menu closes
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');

            // # Reopen, move to the last option with the keyboard and pick it with Enter
            await openAttributeControl(modal, program);
            const lastOptionId = await attribute.choice({id: optionId(program, 'BOREALIS')}).locator.getAttribute('id');
            await combobox.press('End');
            await expect(combobox).toHaveAttribute('aria-activedescendant', lastOptionId ?? '');
            await combobox.press('Enter');

            // * The pick landed, the menu is closed and no channel was created
            await expect(combobox).toHaveValue('BOREALIS');
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            expect(createCount()).toBe(0);

            // # Create from the same, still open, dialog
            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // * Exactly one channel was created, carrying the keyboard pick
            expect(createCount()).toBe(1);
            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(
                optionId(program, 'BOREALIS'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify Escape on a closed combobox closes the create dialog without creating the channel.
     */
    test('closes the modal when Escape is pressed on a closed attribute combobox', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('esc_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            created.push(program);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const createCount = trackChannelCreates(app.page);
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Attr Escape ${suffix}`);
            await expect(modal.name.container).toHaveValue(`Attr Escape ${suffix}`);
            const attribute = modal.attributes.attribute(program);
            const combobox = attribute.valueChoiceCombobox.locator;

            // # Complete the form, then press Escape on the closed field
            await modal.attributes.attribute(program).valueChoiceCombobox.choose('AURORA');
            await expect(modal.attributes.attribute(program).valueChoiceCombobox).toHaveValue('AURORA');
            await combobox.press('Escape');

            // * The dialog closes and nothing is created
            await expect(modal).not.toBeVisible();
            expect(createCount()).toBe(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify Enter on a closed combobox confirms the create dialog once the form is complete.
     */
    test('creates the channel when Enter is pressed on a closed attribute combobox of a complete form', async ({
        pw,
    }) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('enter_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            created.push(program);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const createCount = trackChannelCreates(app.page);
            const modal = await openNewChannelModal(app);
            const displayName = `Attr Enter ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);
            const attribute = modal.attributes.attribute(program);
            const combobox = attribute.valueChoiceCombobox.locator;

            // # Complete the form, then press Enter on the closed field
            await modal.attributes.attribute(program).valueChoiceCombobox.choose('BOREALIS');
            await expect(modal.attributes.attribute(program).valueChoiceCombobox).toHaveValue('BOREALIS');
            await combobox.press('Enter');

            // * The dialog closes and the picked value is stored on the one channel created
            await expect(modal).not.toBeVisible();
            expect(createCount()).toBe(1);
            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(
                optionId(program, 'BOREALIS'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a required combobox shows its error after being left empty or cleared, and hides it once filled.
     */
    test('shows and clears the required error on a required attribute combobox', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('error_program', suffix), {
                options: ['AURORA', 'BOREALIS'],
                required: true,
            });
            created.push(program);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Attr Error ${suffix}`);
            await expect(modal.name.container).toHaveValue(`Attr Error ${suffix}`);
            const attribute = modal.attributes.attribute(program);
            const combobox = attribute.valueChoiceCombobox.locator;

            // * Announced as required, with no error before the field is touched
            await expect(combobox).toHaveAttribute('aria-required', 'true');
            await expect(attribute.errorAlert).toHaveCount(0);
            await expect(modal.confirmButton).toBeDisabled();

            // # Focus the empty field and tab away
            await combobox.focus();
            await combobox.press('Tab');

            // * The error shows, is linked to the field, and Create stays disabled
            await expect(attribute.errorAlert).toContainText('This field is required');
            await expect(combobox).toHaveAttribute('aria-invalid', 'true');
            await expect(combobox).toHaveAccessibleDescription('This field is required');
            await expect(modal.confirmButton).toBeDisabled();

            // # Pick a value
            await modal.attributes.attribute(program).valueChoiceCombobox.choose('AURORA');
            await expect(modal.attributes.attribute(program).valueChoiceCombobox).toHaveValue('AURORA');

            // * The error is gone and Create is enabled
            await expect(attribute.errorAlert).toHaveCount(0);
            await expect(combobox).not.toHaveAttribute('aria-invalid', 'true');
            await expect(modal.confirmButton).toBeEnabled();

            // # Clear the value with the x button
            await attribute.clearButton.click();

            // * The error is back and Create is disabled again
            await expect(attribute.errorAlert).toContainText('This field is required');
            await expect(modal.confirmButton).toBeDisabled();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a rank attribute lists its options highest rank first with rank badges and stores the picked option.
     */
    test('lists a rank attribute highest first with rank badges and stores the picked option', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // Rank order differs from both the stored order and its reverse.
            const level = await createAttribute(adminClient, attributeName('level', suffix), {
                type: 'rank',
                options: ['ALPHA', 'BRAVO', 'CHARLIE'],
                optionRanks: {ALPHA: 2, BRAVO: 3, CHARLIE: 1},
                required: true,
            });
            created.push(level);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            const displayName = `Attr Rank ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);

            // # Open the rank combobox
            const attribute = modal.attributes.attribute(level);
            await openAttributeControl(modal, level);

            // * Highest rank first, each uncoloured option with its badge and no rank text
            expect(await attribute.choiceList.keys()).toEqual(
                ['BRAVO', 'ALPHA', 'CHARLIE'].map((name) => optionId(level, name)),
            );
            for (const [name, rank] of [
                ['BRAVO', '3'],
                ['ALPHA', '2'],
                ['CHARLIE', '1'],
            ]) {
                const choice = attribute.choice({id: optionId(level, name)});
                await expect(choice.badgeText).toHaveText(rank);
                await expect(choice).toHaveText(new RegExp(`^${rank}\\s*${name}$`));
                await expect(choice.swatch).toHaveCount(0);
            }

            // # Pick the middle-ranked option
            await attribute.valueChoiceCombobox.choose('ALPHA');
            await expect(attribute.valueChoiceCombobox).toHaveValue('ALPHA');

            // * The closed field shows it with its badge, and Create is enabled
            await expect(attribute.valueChoiceCombobox).toHaveValue('ALPHA');
            await expect(attribute.badgeText).toHaveText('2');
            await expect(modal.confirmButton).toBeEnabled();

            // # Create the channel
            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // * The stored value is ALPHA's option id
            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(valueFor(await readChannelValues(adminClient, channel.id), level)).toBe(optionId(level, 'ALPHA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify Enter on a focused multiselect chip removes that value without confirming the create dialog.
     */
    test('removes a chip with Enter without creating the channel', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const caveats = await createAttribute(adminClient, attributeName('chip_caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                required: true,
            });
            created.push(caveats);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const createCount = trackChannelCreates(app.page);
            const modal = await openNewChannelModal(app);
            const displayName = `Attr Chip ${suffix}`;
            await modal.name.container.fill(displayName);
            await expect(modal.name.container).toHaveValue(displayName);

            // # Complete the form with both values
            await modal.attributes.attribute(caveats).valueChoiceCombobox.choose('NOFORN');
            await expect(comboboxChips(modal.attributes.attribute(caveats))).toHaveText(['NOFORN']);
            await modal.attributes.attribute(caveats).valueChoiceCombobox.choose('ORCON');
            await expect(comboboxChips(modal.attributes.attribute(caveats))).toHaveText(['NOFORN', 'ORCON']);
            const chips = comboboxChips(modal.attributes.attribute(caveats));
            await expect(chips).toHaveCount(2);

            // # Press Enter on the NOFORN chip
            await chips.first().press('Enter');

            // * The chip is removed and nothing was created
            await expect(chips).toHaveCount(1);
            expect(createCount()).toBe(0);

            // # Create from the same, still open, dialog
            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // * Exactly one channel was created, holding only the remaining value
            expect(createCount()).toBe(1);
            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            expect(valueFor(await readChannelValues(adminClient, channel.id), caveats)).toEqual([
                optionId(caveats, 'ORCON'),
            ]);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a coloured multiselect option shows its swatch on its chip and its menu row.
     */
    test('shows a coloured multiselect option swatch on its chip and menu row', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const caveats = await createAttribute(adminClient, attributeName('swatch_caveats', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                optionColors: {NOFORN: '#1e325c'},
                required: true,
            });
            created.push(caveats);

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);

            // # Pick both values
            await modal.attributes.attribute(caveats).valueChoiceCombobox.choose('NOFORN');
            await expect(comboboxChips(modal.attributes.attribute(caveats))).toHaveText(['NOFORN']);
            await modal.attributes.attribute(caveats).valueChoiceCombobox.choose('ORCON');
            await expect(comboboxChips(modal.attributes.attribute(caveats))).toHaveText(['NOFORN', 'ORCON']);
            const attribute = modal.attributes.attribute(caveats);
            const chips = comboboxChips(attribute);
            await expect(chips).toHaveCount(2);

            // * Only the coloured chip carries a swatch, and the field shows no other
            await expect(chipSwatch(chips.nth(0))).toHaveCSS('background-color', 'rgb(30, 50, 92)');
            await expect(chipSwatch(chips.nth(1))).toHaveCount(0);
            await expect(comboboxSwatches(attribute)).toHaveCount(1);

            // # Open the menu
            await openAttributeControl(modal, caveats);

            // * Only the coloured row carries a swatch
            await expect(attribute.choice({id: optionId(caveats, 'NOFORN')}).swatch).toBeVisible();
            await expect(attribute.choice({id: optionId(caveats, 'ORCON')}).swatch).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
