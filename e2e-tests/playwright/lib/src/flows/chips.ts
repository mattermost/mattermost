// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Driver} from '@/aria/drivers';
import {expect} from '@/aria/matchers';

/**
 * Removes a removable chip (a Compass `Chip` with `onRemove`) by clicking its remove icon. The chip itself is the
 * button (give its testid `--button`); the icon inside it is the library's, hidden from the accessibility tree, and
 * has no testid of its own: `data-chip-remove` is its stable marker.
 */
export async function removeChip(chip: Driver): Promise<void> {
    await chip.locator.locator('[data-chip-remove]').click();
    await expect(chip).not.toBeVisible();
}
