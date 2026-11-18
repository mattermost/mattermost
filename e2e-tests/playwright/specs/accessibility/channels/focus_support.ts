// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, type AnyDriver, type Scope} from '@mattermost/playwright-lib';

/** Checks focus and visibility before reading the browser's focus-visible pseudo-class. */
export async function focusVisible(element: AnyDriver | Scope | Locator): Promise<boolean> {
    await expect(element).toBeVisible();
    await expect(element).toBeFocused();
    // The focus-visible pseudo-class requires a DOM predicate rather than an ARIA matcher.
    const locator = 'meta' in element || 'scope' in element ? element.locator : element;
    return locator.evaluate((node) => node.matches(':focus-visible'));
}
