// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect} from '@/aria/matchers';

/**
 * The chips of a multiselect combobox (a Compass `Combobox` with `multiple`) inside `field`: the library renders them
 * without testids, so `data-chip` is their stable marker. Assert their text with `toHaveText([...])`.
 */
export function comboboxChips(field: {locator: Locator}): Locator {
    return field.locator.locator('[data-chip]');
}

/** Removes the chip labelled `label` from a multiselect combobox inside `field`, through its remove icon. */
export async function removeComboboxChip(field: {locator: Locator}, label: string): Promise<void> {
    const chip = comboboxChips(field).filter({hasText: label});
    await chip.locator('[data-chip-remove]').click();
    await expect(chip).toHaveCount(0);
}
