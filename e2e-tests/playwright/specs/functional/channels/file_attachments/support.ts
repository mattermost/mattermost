// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

/**
 * Shared helpers for the edit_file_attachment_* spec group.
 *
 * Scoped to sibling specs that exercise editing posts with file attachments:
 *   - edit_file_attachment_add.spec.ts
 *   - edit_file_attachment_remove.spec.ts
 *   - edit_file_attachment_restore.spec.ts
 *
 * Other pre-existing specs in this folder (e.g. edit_message_with_attachment)
 * intentionally do not use these helpers.
 */

/** Default placeholder message reused by every edit_file_attachment_* spec. */
export const ORIGINAL_MESSAGE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

/**
 * Moves the mouse to the top-left corner of the viewport.
 * Used after clickOnDotMenu() to ensure tooltips/hover state do not obscure
 * the post dot menu in subsequent interactions.
 */
export async function moveMouseToCenter(page: Page) {
    await page.mouse.move(0, 0);
}
