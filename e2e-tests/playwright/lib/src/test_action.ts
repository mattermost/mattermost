// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, Page, expect} from '@playwright/test';
export {waitUntil} from 'async-wait-until';

const visibilityHidden = 'visibility: hidden !important;';
const hideTeamHeader = `#sidebarTeamMenuButton {${visibilityHidden}} `;
const hidePostHeaderTime = `.post__time {${visibilityHidden}} `;
const hidePostProfileIcon = `.profile-icon {${visibilityHidden}} `;
const hideKeywordsAndMentionsDesc = `#keywordsAndMentionsDesc {${visibilityHidden}} `;

export async function hideDynamicChannelsContent(page: Page) {
    await page.addStyleTag({
        content: hideTeamHeader + hidePostHeaderTime + hidePostProfileIcon + hideKeywordsAndMentionsDesc,
    });
}

export async function waitForAnimationEnd(locator: Locator) {
    return locator.evaluate((element) =>
        Promise.all(element.getAnimations({subtree: true}).map((animation) => animation.finished)),
    );
}

export async function toBeFocusedWithFocusVisible(locator: Locator) {
    await expect(locator).toBeFocused();
    return locator.evaluate((element) => element.matches(':focus-visible'));
}
