// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

/**
 * Selects `phrase` inside the given post message by dragging the mouse over it, like a user does,
 * from left to right or, with `backward`, from right to left.
 */
export async function selectTextWithMouse(message: Locator, phrase: string, {backward = false} = {}) {
    await message.scrollIntoViewIfNeeded();

    const bounds = await message.evaluate((element, text) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const index = node.textContent?.indexOf(text) ?? -1;
            if (index === -1) {
                continue;
            }

            const charRect = (offset: number) => {
                const range = document.createRange();
                range.setStart(node!, offset);
                range.setEnd(node!, offset + 1);
                return range.getBoundingClientRect();
            };
            const first = charRect(index);
            const last = charRect(index + text.length - 1);

            return {
                start: {x: first.left + 1, y: first.top + first.height / 2},
                end: {x: last.right - 1, y: last.top + last.height / 2},
            };
        }

        return null;
    }, phrase);

    if (!bounds) {
        throw new Error(`Couldn't find "${phrase}" in the post message`);
    }

    const [from, to] = backward ? [bounds.end, bounds.start] : [bounds.start, bounds.end];

    // Hovering first waits until the message receives pointer events, such as once the initial
    // loading screen has faded out, since raw mouse moves don't wait for anything.
    const box = (await message.boundingBox())!;
    await message.hover({position: {x: from.x - box.x, y: from.y - box.y}});

    const mouse = message.page().mouse;
    await mouse.down();
    await mouse.move(to.x, to.y, {steps: 10});
    await mouse.up();
}
