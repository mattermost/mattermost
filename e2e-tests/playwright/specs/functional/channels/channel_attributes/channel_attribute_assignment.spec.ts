// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            // Only the channel-scoped attributes belong here; a user attribute in
            // the same group must not leak into channel creation.
            await expect(page.getByTestId(`channelAttributeRow-${program.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${caveats.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${note.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelAttributeRow-${userScoped.name}`)).toHaveCount(0);

            const displayName = `Attr Channel ${suffix}`;
            await modal.fillDisplayName(displayName);

            await page.getByTestId(`channelAttribute-${program.name}`).click();
            await page.getByText('AURORA', {exact: true}).click();

            // The menu closes on each pick, so a multiselect needs reopening to
            // add the second value. Two values is what proves the array shape.
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('NOFORN', {exact: true}).click();
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('ORCON', {exact: true}).click();

            await page.getByLabel(note.name, {exact: true}).fill('handle with care');

            await modal.create();

            // The values ride the create request, so the modal closing means the
            // channel and its values both landed. The channel header is already
            // visible from before, so waiting on it proves nothing.
            await expect(modal.container).not.toBeVisible();

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            const displayName = `Attr Private ${suffix}`;
            await modal.fillDisplayName(displayName);
            await modal.privateTypeButton.click();

            await page.getByTestId(`channelAttribute-${program.name}`).click();
            await page.getByText('BOREALIS', {exact: true}).click();

            await modal.create();
            await expect(modal.container).not.toBeVisible();

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            const createCount = trackChannelCreates(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            const displayName = `Attr Keyboard ${suffix}`;
            await modal.fillDisplayName(displayName);
            const combobox = modal.getAttributeCombobox(program.name);

            // # Complete the form
            await modal.selectAttributeOption(program.name, 'AURORA');

            // # Open the menu and press Escape
            await modal.openAttributeCombobox(program.name);
            await combobox.press('Escape');

            // * Only the menu closes
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');

            // # Reopen, move to the last option with the keyboard and pick it with Enter
            await modal.openAttributeCombobox(program.name);
            await combobox.press('End');
            const lastOptionId = await modal
                .getAttributeOption(program.name, optionId(program, 'BOREALIS'))
                .getAttribute('id');
            await expect(combobox).toHaveAttribute('aria-activedescendant', lastOptionId ?? '');
            await combobox.press('Enter');

            // * The pick landed, the menu is closed and no channel was created
            await expect(combobox).toHaveValue('BOREALIS');
            await expect(combobox).toHaveAttribute('aria-expanded', 'false');
            expect(createCount()).toBe(0);

            // # Create from the same, still open, dialog
            await modal.create();
            await expect(modal.container).not.toBeVisible();

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            const createCount = trackChannelCreates(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Escape ${suffix}`);
            const combobox = modal.getAttributeCombobox(program.name);

            // # Complete the form, then press Escape on the closed field
            await modal.selectAttributeOption(program.name, 'AURORA');
            await combobox.press('Escape');

            // * The dialog closes and nothing is created
            await expect(modal.container).not.toBeVisible();
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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            const createCount = trackChannelCreates(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            const displayName = `Attr Enter ${suffix}`;
            await modal.fillDisplayName(displayName);
            const combobox = modal.getAttributeCombobox(program.name);

            // # Complete the form, then press Enter on the closed field
            await modal.selectAttributeOption(program.name, 'BOREALIS');
            await combobox.press('Enter');

            // * The dialog closes and the picked value is stored on the one channel created
            await expect(modal.container).not.toBeVisible();
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Error ${suffix}`);
            const combobox = modal.getAttributeCombobox(program.name);

            // * Announced as required, with no error before the field is touched
            await expect(combobox).toHaveAttribute('aria-required', 'true');
            await expect(modal.getAttributeError(program.name)).toHaveCount(0);
            await expect(modal.createButton).toBeDisabled();

            // # Focus the empty field and tab away
            await combobox.focus();
            await combobox.press('Tab');

            // * The error shows, is linked to the field, and Create stays disabled
            await expect(modal.getAttributeError(program.name)).toContainText('This field is required');
            await expect(combobox).toHaveAttribute('aria-invalid', 'true');
            await expect(combobox).toHaveAccessibleDescription('This field is required');
            await expect(modal.createButton).toBeDisabled();

            // # Pick a value
            await modal.selectAttributeOption(program.name, 'AURORA');

            // * The error is gone and Create is enabled
            await expect(modal.getAttributeError(program.name)).toHaveCount(0);
            await expect(combobox).not.toHaveAttribute('aria-invalid', 'true');
            await expect(modal.createButton).toBeEnabled();

            // # Clear the value with the x button
            await modal.getAttributeClearButton(program.name).click();

            // * The error is back and Create is disabled again
            await expect(modal.getAttributeError(program.name)).toContainText('This field is required');
            await expect(modal.createButton).toBeDisabled();
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            const displayName = `Attr Rank ${suffix}`;
            await modal.fillDisplayName(displayName);

            // # Open the rank combobox
            const listbox = await modal.openAttributeCombobox(level.name);

            // * Highest rank first, each uncoloured option with its badge and no rank text
            await modal.expectAttributeOptionOrder(
                level.name,
                ['BRAVO', 'ALPHA', 'CHARLIE'].map((name) => optionId(level, name)),
            );
            await expect(listbox.getByTestId('rank-badge')).toHaveText(['3', '2', '1']);
            await expect(listbox.getByRole('option')).toHaveText([/^3\s*BRAVO$/, /^2\s*ALPHA$/, /^1\s*CHARLIE$/]);
            await expect(listbox.getByTestId('attribute-option-swatch')).toHaveCount(0);

            // # Pick the middle-ranked option
            await modal.selectAttributeOption(level.name, 'ALPHA');

            // * The closed field shows it with its badge, and Create is enabled
            await expect(modal.getAttributeCombobox(level.name)).toHaveValue('ALPHA');
            await expect(modal.getAttributeRow(level.name).getByTestId('rank-badge')).toHaveText('2');
            await expect(modal.createButton).toBeEnabled();

            // # Create the channel
            await modal.create();
            await expect(modal.container).not.toBeVisible();

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            const createCount = trackChannelCreates(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            const displayName = `Attr Chip ${suffix}`;
            await modal.fillDisplayName(displayName);

            // # Complete the form with both values
            await modal.selectAttributeOption(caveats.name, 'NOFORN');
            await modal.selectAttributeOption(caveats.name, 'ORCON');
            const chips = modal.getAttributeChips(caveats.name);
            await expect(chips).toHaveCount(2);

            // # Press Enter on the NOFORN chip
            await chips.filter({has: page.getByText('NOFORN', {exact: true})}).press('Enter');

            // * The chip is removed and nothing was created
            await expect(chips).toHaveCount(1);
            expect(createCount()).toBe(0);

            // # Create from the same, still open, dialog
            await modal.create();
            await expect(modal.container).not.toBeVisible();

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

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();

            // # Pick both values
            await modal.selectAttributeOption(caveats.name, 'NOFORN');
            await modal.selectAttributeOption(caveats.name, 'ORCON');
            const chips = modal.getAttributeChips(caveats.name);
            await expect(chips).toHaveCount(2);

            // * Only the coloured chip carries a swatch, and the field shows no other
            const nofornChip = chips.filter({has: page.getByText('NOFORN', {exact: true})});
            const orconChip = chips.filter({has: page.getByText('ORCON', {exact: true})});
            await expect(nofornChip.getByTestId('attribute-option-swatch')).toHaveCSS(
                'background-color',
                'rgb(30, 50, 92)',
            );
            await expect(orconChip.getByTestId('attribute-option-swatch')).toHaveCount(0);
            await expect(modal.getAttributeRow(caveats.name).getByTestId('attribute-option-swatch')).toHaveCount(1);

            // # Open the menu
            await modal.openAttributeCombobox(caveats.name);

            // * Only the coloured row carries a swatch
            await expect(
                modal
                    .getAttributeOption(caveats.name, optionId(caveats, 'NOFORN'))
                    .getByTestId('attribute-option-swatch'),
            ).toBeVisible();
            await expect(
                modal
                    .getAttributeOption(caveats.name, optionId(caveats, 'ORCON'))
                    .getByTestId('attribute-option-swatch'),
            ).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
