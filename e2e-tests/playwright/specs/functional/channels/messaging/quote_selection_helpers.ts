// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

/**
 * Selects `phrase` inside the given post message by dragging the mouse over it, like a user does,
 * from left to right or, with `backward`, from right to left. With `untilPhrase`, the selection
 * goes from the start of `phrase` to the end of `untilPhrase`.
 */
export async function selectTextWithMouse(
    message: Locator,
    phrase: string,
    {backward = false, untilPhrase}: {backward?: boolean; untilPhrase?: string} = {},
) {
    await message.scrollIntoViewIfNeeded();

    const bounds = await message.evaluate(
        (element, {start, end}) => {
            const findCharacter = (text: string, edge: 'first' | 'last') => {
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
                    const index = node.data.indexOf(text);
                    if (index !== -1) {
                        const offset = edge === 'first' ? index : index + text.length - 1;
                        const range = document.createRange();
                        range.setStart(node, offset);
                        range.setEnd(node, offset + 1);
                        return range.getBoundingClientRect();
                    }
                }
                return null;
            };

            const first = findCharacter(start, 'first');
            const last = findCharacter(end, 'last');
            if (!first || !last) {
                return null;
            }

            return {
                start: {x: first.left + 1, y: first.top + first.height / 2},
                end: {x: last.right - 1, y: last.top + last.height / 2},
            };
        },
        {start: phrase, end: untilPhrase ?? phrase},
    );

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
