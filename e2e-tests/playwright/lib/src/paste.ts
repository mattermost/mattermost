// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {Driver} from '@/aria/drivers';

/**
 * Simulates pasting HTML (with a plain-text fallback) into a textbox, exercising Mattermost's
 * own paste-formatting logic (e.g. an HTML table auto-converting to a markdown table) rather
 * than just typing raw text.
 *
 * Dispatches a synthetic ClipboardEvent directly on the textbox: Playwright/CDP can't write
 * arbitrary HTML to the real OS clipboard and have a genuinely OS-triggered paste read it back
 * deterministically in CI, so this mirrors the technique this codebase's own unit tests use
 * (`utils/paste.test.tsx`), just exercised through the real running app instead of a mock.
 *
 * When `withoutFormatting` is true, a Ctrl+Shift+V keydown is dispatched first to set the
 * app's internal `isNonFormattedPaste` flag (see `advanced_text_editor/use_key_handler.tsx`),
 * which makes the app's paste handler step aside instead of auto-converting the HTML.
 *
 * A synthetic (untrusted) paste event never triggers the browser's own default paste, so when
 * the app steps aside (doesn't call `preventDefault`) the plain-text fallback is inserted here
 * to mirror what a real, OS-triggered paste would do.
 */
export async function pasteHtml(
    input: Driver,
    html: string,
    plainText: string,
    {withoutFormatting = false}: {withoutFormatting?: boolean} = {},
) {
    await expect(input.locator).toBeVisible();
    await input.locator.focus();

    // A synthetic paste event has no driver verb: it needs the element itself.
    await input.locator.evaluate(
        (el, {html, plainText, withoutFormatting}) => {
            if (withoutFormatting) {
                el.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'v',
                        ctrlKey: true,
                        shiftKey: true,
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            }

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/html', html);
            dataTransfer.setData('text/plain', plainText);
            const notCancelled = el.dispatchEvent(
                new ClipboardEvent('paste', {clipboardData: dataTransfer, bubbles: true, cancelable: true}),
            );

            if (notCancelled) {
                document.execCommand('insertText', false, plainText);
            }
        },
        {html, plainText, withoutFormatting},
    );
}
