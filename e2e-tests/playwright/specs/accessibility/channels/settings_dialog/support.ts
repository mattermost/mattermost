// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** A CSS selector for a generated element, for axe's `include()` (which takes selectors, not locators). */
export function selectorOf(driver: {meta: {testId: string}}): string {
    return `[data-testid="${driver.meta.testId}"]`;
}
