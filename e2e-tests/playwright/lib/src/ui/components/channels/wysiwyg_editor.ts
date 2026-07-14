// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class WysiwygEditor {
    readonly container: Locator;
    readonly input: Locator;
    readonly formattingBar: Locator;
    readonly page: Page;

    constructor(container: Locator, isRHS = false) {
        this.container = container;
        this.page = container.page();
        this.input = container.locator(isRHS ? '[data-testid="reply_textbox"]' : '[data-testid="post_textbox"]');
        this.formattingBar = container.getByTestId('formattingBarContainer');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.input).toBeVisible();
        await expect(this.input).toHaveAttribute('role', 'textbox');
        await expect(this.input).toHaveAttribute('contenteditable', 'true');
    }

    async focus() {
        await this.input.click();
    }

    async clear() {
        await this.focus();
        await this.input.press('ControlOrMeta+a');
        await this.input.press('Delete');
    }

    // pressSequentially, not fill(): ProseMirror needs per-keystroke transactions.
    async type(text: string) {
        await this.focus();
        await this.input.pressSequentially(text);
    }

    async press(key: string) {
        await this.input.press(key);
    }

    async textContent(): Promise<string> {
        return (await this.input.textContent()) ?? '';
    }

    async isEmpty(): Promise<boolean> {
        return (await this.textContent()).trim() === '';
    }

    async sendByEnter() {
        await this.input.press('Enter');
    }

    async sendByCtrlEnter() {
        await this.input.press('ControlOrMeta+Enter');
    }

    async sendByButton() {
        const btn = this.container.getByTestId('SendMessageButton');
        await expect(btn).toBeEnabled();
        await btn.click();
    }

    async postMessage(text: string) {
        await this.type(text);
        await this.sendByButton();
    }

    suggestionList() {
        return this.container.getByRole('listbox', {name: 'Suggestions'});
    }

    placeholder() {
        return this.container.locator('.ProseMirror .is-editor-empty[data-placeholder]');
    }

    async pasteText(text: string, html?: string) {
        await this.focus();
        await this.input.evaluate(
            (el, {text, html}) => {
                const dt = new DataTransfer();
                dt.setData('text/plain', text);
                if (html) {
                    dt.setData('text/html', html);
                }
                el.dispatchEvent(
                    new ClipboardEvent('paste', {
                        clipboardData: dt,
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            },
            {text, html},
        );
    }
}
