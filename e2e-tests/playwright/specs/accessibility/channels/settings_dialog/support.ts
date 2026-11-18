// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** A CSS selector for a generated element, for axe's `include()` (which takes selectors, not locators). */
export function selectorOf(driver: {meta: {testId: string}}): string {
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- axe's include() takes a CSS selector and cannot take a locator
    return `[data-testid="${driver.meta.testId}"]`;
}
