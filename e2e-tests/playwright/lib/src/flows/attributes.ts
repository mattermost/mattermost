// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect} from '@/aria/matchers';
import type {App} from '@/ui/generated';

/**
 * Channel attributes on the generated page objects, for the specs that set them up from elsewhere (the System
 * Console's attribute and classification pages). Labels (the channel header's, a thread's) are chips keyed by field
 * id; the editable block (Channel Info in the RHS, and the same editor in Channel Settings' Info tab) has rows keyed by
 * field id, whose values are chips keyed by value or a text value.
 */

type Field = {id: string};
export type AttributeLabels = App['channelHeader']['attributes'] | App['threads']['pane']['attributes'];
export type EditableAttributes = App['rhs']['channelInfo']['about']['attributes'];

/** Opens Channel Info in the RHS (the header button toggles, so only when it isn't already showing). */
export async function openChannelInfo(app: App) {
    const header = app.rhs.channelInfo.header;
    if (!(await header.container.isVisible())) {
        await app.channelHeader.infoButton.click();
    }
    await expect(header).toBeVisible();
    return app.rhs.channelInfo.about.attributes;
}

/** A field's row in the editable block. */
export function attributeRow(attributes: EditableAttributes, field: Field) {
    return attributes.attribute(field);
}

/** A row's first value: its first chip (select fields; chips are keyed by value) or its text value. */
export async function attributeValue(attributes: EditableAttributes, field: Field) {
    const row = attributeRow(attributes, field);
    await expect(async () => {
        expect((await row.valueText.isVisible()) || (await row.chipList.keys()).length > 0).toBe(true);
    }).toPass();
    return (await row.valueText.isVisible()) ? row.valueText : row.chipList.first();
}

/** The generated label chip showing a value. */
export async function labelChip(labels: AttributeLabels, value: string) {
    return labels.chipList.itemWith({text: value});
}

/** Matching label chips, including an empty collection for absence assertions. */
export function labelChips(labels: AttributeLabels, value: string): Locator {
    // An absent value has no key to resolve through itemWith.
    return labels.chipList.locator.filter({hasText: value});
}

/** Picks an option by name from an open select list (react-select's menu: options by role and name). */
export async function pickListOption(app: App, option: string) {
    // React-select's portal is library-rendered; reach its option by its accessible name.
    const choice = app.page.getByRole('option', {name: option, exact: true});
    await choice.click();
    await expect(choice).not.toBeVisible();
}

/** Opens an attribute's control in the new-channel dialog: a select's is the dropdown itself, a graph picker's its button. */
export async function openAttributeControl(modal: App['newChannelModal'], field: Field) {
    const attribute = modal.attributes.attribute(field);
    if (await attribute.valueButton.isVisible()) {
        await attribute.valueButton.click();
        await expect(attribute.valueButton).toHaveAttribute('aria-expanded', 'true');
    } else {
        await attribute.valueChoiceCombobox.press('ArrowDown');
        await expect(attribute.valueChoiceCombobox).toHaveAttribute('aria-expanded', 'true');
    }
}

/** Opens the new-channel dialog from the sidebar's "+" menu, once its name field shows. */
export async function openNewChannelModal(app: App) {
    await app.lhs.header.openBrowseOrAddMenuButton.click();
    await expect(app.lhs.browseOrAddMenu.createChannelMenuItem).toBeVisible();
    await app.lhs.browseOrAddMenu.createChannelMenuItem.click();
    const modal = app.newChannelModal;
    await expect(modal.name.container).toBeVisible();
    return modal;
}

/** The library-rendered chips of a multiselect combobox, inside its generated field. */
export function comboboxChips(field: {locator: Locator}): Locator {
    // Compass owns the unkeyed chip nodes; the generated field has no chip part.
    return field.locator.locator('[data-chip]');
}

/** Removes a library-rendered chip by its label and stable remove marker. */
export async function removeComboboxChip(field: {locator: Locator}, label: string): Promise<void> {
    // Compass exposes this remove marker on each chip, without a generated remove-button part.
    await comboboxChips(field).filter({hasText: label}).locator('[data-chip-remove]').click();
    await expect(comboboxChips(field).filter({hasText: label})).toHaveCount(0);
}

/** Swatches rendered inside a combobox by the option's value renderer. */
export function comboboxSwatches(field: {locator: Locator}): Locator {
    // Compass copies option visuals into unkeyed chips; generated choice swatches are rooted in menu rows instead.
    return field.locator.locator('.AttributeOptionSwatch');
}

/** A library-rendered chip's copy of its option swatch. */
export function chipSwatch(chip: Locator): Locator {
    // This copied option visual has no generated part inside a Compass chip.
    return chip.locator('.AttributeOptionSwatch');
}
