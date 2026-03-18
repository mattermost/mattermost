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
    await expect(locator).toBeVisible();
    await expect(locator).toBeFocused();
    return locator.evaluate((element) => element.matches(':focus-visible'));
}

export async function logFocusedElement(page: Page) {
    const focusedElementInfo = await page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!activeElement) {
            return 'No element has focus';
        }

        const tagName = activeElement.tagName.toLowerCase();
        const id = activeElement.id ? `#${activeElement.id}` : '(none)';
        const className = activeElement.className ? `.${Array.from(activeElement.classList).join('.')}` : '(none)';
        const role = activeElement.getAttribute('role') || '';
        const ariaLabel = activeElement.getAttribute('aria-label') || '';
        const text = activeElement.textContent?.slice(0, 50) || '';
        const htmlElement = activeElement as HTMLElement;

        return {
            selector: `tag: ${tagName} | id: ${id} | class: ${className}`,
            role: role,
            ariaLabel: ariaLabel,
            text: text.length > 50 ? `${text}...` : text,
            nodeName: activeElement.nodeName,
            isVisible: htmlElement.offsetWidth > 0 && htmlElement.offsetHeight > 0,
        };
    });

    // eslint-disable-next-line no-console
    console.log('Currently focused element:', focusedElementInfo);
    return focusedElementInfo;
}
