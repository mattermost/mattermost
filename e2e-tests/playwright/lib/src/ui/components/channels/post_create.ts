// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';
import {assetPath} from '@/file';
import {waitUntil} from '@/test_action';

export default class ChannelsPostCreate {
    readonly container: Locator;
    readonly input;

    readonly plusButton;
    readonly plusMenu;
    readonly attachFilesItem;
    readonly emojiMenuItem;
    readonly emojiButton;
    readonly formattingBar;
    readonly sendMessageButton;

    // Scheduled send stays on the send split, beside Send. Agent mode hides it.
    readonly scheduleMessageButton;
    readonly priorityMenuItem;
    readonly priorityButton;
    readonly priorityLabel;
    readonly removeLabelsButton;
    readonly removeLabelsTooltip;
    readonly suggestionList;
    readonly suggestionOptions;
    readonly selectedSuggestion;
    readonly filePreview;
    readonly filePreviewItems;
    readonly messageTooLongWarning;
    readonly previewButton;
    readonly previewArea;

    // Burn-on-Read elements
    readonly burnOnReadButton;
    readonly burnOnReadLabel;
    readonly burnOnReadLabelRemoveButton;
    readonly removeAllLabelsButton;

    constructor(container: Locator, isRHS = false) {
        this.container = container;

        if (isRHS) {
            this.input = container.getByTestId('reply_textbox');
        } else {
            this.input = container.getByTestId('post_textbox');
        }

        this.plusButton = container.getByTestId('agent-composer-menu-button');
        this.plusMenu = container.page().getByRole('menu', {name: 'Message options'});
        this.attachFilesItem = this.plusMenu.getByRole('menuitem', {name: 'Attach files', exact: true});
        this.emojiMenuItem = this.plusMenu.getByRole('menuitem', {name: 'Emoji', exact: true});
        this.emojiButton = container.locator('#emojiPickerButton');
        this.formattingBar = container.getByTestId('formattingBarContainer');
        this.sendMessageButton = container.getByTestId('SendMessageButton');
        this.scheduleMessageButton = container.getByLabel('Schedule message');
        this.priorityMenuItem = this.plusMenu.getByRole('menuitem', {name: 'Message priority', exact: true});
        this.priorityButton = container.locator('#messagePriority');
        this.priorityLabel = container.getByTestId('post-priority-label');
        this.removeLabelsButton = container.getByRole('button', {name: 'Remove all labels'});
        // Tooltips render in a portal outside the post create container.
        this.removeLabelsTooltip = container.page().getByRole('tooltip', {name: 'Remove all labels'});
        this.suggestionList = container.getByRole('listbox', {name: 'Suggestions'});
        this.suggestionOptions = this.suggestionList.getByRole('option');
        this.selectedSuggestion = this.suggestionList.getByTestId('suggestion-selected');
        this.filePreview = container.getByTestId('file-preview-container');
        this.filePreviewItems = this.filePreview.getByTestId('file-preview-item');
        this.messageTooLongWarning = container.getByText(/Your message is too long\. Character count:/);
        this.previewButton = container.getByRole('button', {name: 'preview'});
        this.previewArea = container.locator('.textbox-preview-area');

        // Burn-on-Read elements
        // Use a flexible locator that matches the aria-label pattern
        this.burnOnReadButton = this.plusMenu.getByRole('menuitem', {name: 'Burn-on-read', exact: true});
        this.burnOnReadLabel = container.getByTestId('burn-on-read-label');

        // Two distinct remove controls can sit on the label row: the label's own X and
        // UnifiedLabelsWrapper's remove-all. Kept separate so a spec can assert which
        // of them is present rather than counting anonymous buttons.
        this.burnOnReadLabelRemoveButton = container.getByRole('button', {name: 'Remove burn-on-read'});
        this.removeAllLabelsButton = container.getByRole('button', {name: 'Remove all labels'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();

        await this.input.waitFor();
        await expect(this.input).toBeVisible();
    }

    /**
     * It just writes the message in the input and doesn't send it
     * @param message : Message to be written in the input
     */
    async writeMessage(message: string) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        await this.input.fill(message);
    }

    /**
     * Types the message into the input one keystroke at a time, the way a user does, without sending it.
     * Prefer this over writeMessage when the behaviour under test depends on the input changing more than
     * once, such as the autocomplete, which debounces each change before searching the server.
     * @param message : Message to be typed into the input
     * @param options.delay : Milliseconds to wait between keystrokes. Use a delay longer than the
     * autocomplete's debounce when a search per keystroke is wanted.
     */
    async typeMessage(message: string, options?: {delay?: number}) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        await this.input.pressSequentially(message, options);
    }

    /**
     * Returns the value of the message input
     */
    async getInputValue() {
        await expect(this.input).toBeVisible();
        return this.input.inputValue();
    }

    /**
     * Sends the message already written in the input
     */
    async sendMessage() {
        await this.closePlusMenu();
        await expect(this.input).toBeVisible();
        const messageInputValue = await this.getInputValue();
        expect(messageInputValue).not.toBe('');

        await expect(this.sendMessageButton).toBeVisible();
        await expect(this.sendMessageButton).toBeEnabled();

        await this.sendMessageButton.click();
    }

    /**
     * Opens the + menu. Attach, burn-on-read, and rewrite are items in it.
     * Emoji and priority are items here only while the formatting bar is hidden.
     */
    async openPlusMenu() {
        if ((await this.plusButton.getAttribute('aria-expanded')) !== 'true') {
            await expect(this.plusButton).toBeVisible();
            await this.plusButton.click();
        }
        await expect(this.plusButton).toHaveAttribute('aria-expanded', 'true');
        await expect(this.plusMenu).toBeVisible();
    }

    async closePlusMenu() {
        if ((await this.plusButton.getAttribute('aria-expanded')) !== 'true') {
            return;
        }

        // The open menu's backdrop covers the + button, so a click there never lands.
        // Escape is what dismisses the menu.
        await this.plusMenu.press('Escape');
        await expect(this.plusButton).toHaveAttribute('aria-expanded', 'false');
    }

    private async formattingBarOpen() {
        return this.formattingBar.isVisible();
    }

    /**
     * Opens the message priority picker. The formatting bar holds the button
     * while it is open. The + menu holds the row while the bar is hidden.
     */
    async openPriorityMenu() {
        if (await this.formattingBarOpen()) {
            await expect(this.priorityButton).toBeVisible();
            await expect(this.priorityButton).toBeEnabled();
            await this.priorityButton.click();
            return;
        }

        await this.openPlusMenu();
        await expect(this.priorityMenuItem).toBeVisible();
        await expect(this.priorityMenuItem).toBeEnabled();
        await this.priorityMenuItem.click();
    }

    /**
     * Priority is a formatting-bar button while that bar is open, and a + menu
     * row while the bar is hidden.
     */
    async toShowPriorityItem() {
        if (await this.formattingBarOpen()) {
            await expect(this.priorityButton).toBeVisible();
            return;
        }

        await this.openPlusMenu();
        await expect(this.priorityMenuItem).toBeVisible();
    }

    async toOmitPriorityItem() {
        await expect(this.priorityButton).toHaveCount(0);
        await this.openPlusMenu();
        await expect(this.priorityMenuItem).toHaveCount(0);
        await this.closePlusMenu();
    }

    async expectAttachFilesEnabled(timeout?: number) {
        await this.openPlusMenu();
        await expect(this.attachFilesItem).toBeEnabled({timeout});
        await this.closePlusMenu();
    }

    async expectAttachFilesDisabled(timeout?: number) {
        await this.openPlusMenu();
        await expect(this.attachFilesItem).toBeDisabled({timeout});
        await this.closePlusMenu();
    }

    /**
     * Composes and sends a message
     */
    async postMessage(message: string, files?: string[]) {
        await this.writeMessage(message);

        const page = this.container.page();
        const uploadResponsePromise =
            files && files.length > 0
                ? page.waitForResponse(
                      (r) =>
                          r.url().includes('/api/v4/files') &&
                          r.request().method() === 'POST' &&
                          r.status() >= 200 &&
                          r.status() < 300,
                      {timeout: 60000},
                  )
                : null;

        if (files) {
            const filePaths = files.map((file) => path.join(assetPath, file));
            const fileInput = this.container.locator('input[type="file"]');
            await expect(fileInput).toBeAttached();
            await fileInput.setInputFiles(filePaths);
            // Wait for the upload API first so the 10s preview asserts run after
            // the file exists, instead of racing the default expect timeout.
            if (uploadResponsePromise) {
                await uploadResponsePromise;
            }
            await this.waitUntilFilePreviewContains(files);
        }

        await this.sendMessage();
    }

    /**
     * Selects a slash command from the autocomplete suggestion list
     * @param keystrokes - The partial text to type that triggers autocomplete (e.g., "/cr")
     * @param expectedCommand - The command we expect to see and select (e.g., "/crash")
     */
    async selectSlashCommandFromAutocomplete(keystrokes: string, expectedCommand: string) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        // Type the keystrokes to trigger autocomplete
        await this.input.fill(keystrokes);

        // Wait for the suggestion list to appear
        await expect(this.suggestionList).toBeVisible();

        // Verify the expected command appears in the suggestions
        const suggestion = this.suggestionList.getByText(expectedCommand);
        await expect(suggestion).toBeVisible();

        // Click to select the command
        await suggestion.click();
    }

    /**
     * Types the given keystrokes to trigger the autocomplete suggestion list,
     * optionally moves the highlight down with ArrowDown, then completes the
     * highlighted suggestion by pressing Tab.
     * @param keystrokes - Partial text that triggers autocomplete (e.g. "@jo", ":tomato")
     * @param options.arrowDown - Number of ArrowDown presses before selecting
     */
    async selectFromAutocompleteWithTab(keystrokes: string, {arrowDown = 0}: {arrowDown?: number} = {}) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        await this.input.fill(keystrokes);
        await expect(this.suggestionList).toBeVisible();

        for (let i = 0; i < arrowDown; i++) {
            await this.input.press('ArrowDown');
        }

        await this.input.press('Tab');
    }

    async openEmojiPicker() {
        if (await this.formattingBarOpen()) {
            await expect(this.emojiButton).toBeVisible();
            await expect(this.emojiButton).toBeEnabled();
            await this.emojiButton.click();
            return;
        }

        await this.openPlusMenu();
        await expect(this.emojiMenuItem).toBeVisible();
        await this.emojiMenuItem.click();
    }

    async selectFiles(files: File | File[]) {
        const selectedFiles = Array.isArray(files) ? files : [files];
        const fileChooserPromise = this.container.page().waitForEvent('filechooser');
        await this.openPlusMenu();
        await this.attachFilesItem.click();
        const fileChooser = await fileChooserPromise;
        const payloads = await Promise.all(
            selectedFiles.map(async (file) => ({
                name: file.name,
                mimeType: file.type,
                buffer: Buffer.from(await file.arrayBuffer()),
            })),
        );
        await fileChooser.setFiles(payloads);
        await this.waitUntilFilePreviewContains(selectedFiles.map((file) => file.name));
    }

    getFilePreviewItem(fileName: string) {
        return this.filePreviewItems.filter({hasText: fileName});
    }

    async toHaveFilePreview(fileName: string) {
        const item = this.getFilePreviewItem(fileName);
        await expect(item).toBeVisible();
        await expect(item.getByLabel(/file thumbnail/i)).toBeVisible();
    }

    async removeFilePreview(fileName: string) {
        await this.getFilePreviewItem(fileName).getByTestId('file-preview-remove').click();
    }

    async toHaveFilePreviewCount(count: number) {
        await expect(this.filePreviewItems).toHaveCount(count);
    }

    async toNotHaveMessageTooLongWarning() {
        await expect(this.messageTooLongWarning).not.toBeVisible();
    }

    async toHaveMessageTooLongWarning(characterCount: number, maximum: number) {
        await expect(
            this.container.getByText(`Your message is too long. Character count: ${characterCount}/${maximum}`, {
                exact: true,
            }),
        ).toBeVisible();
    }

    async togglePreview() {
        await expect(this.previewButton).toBeVisible();
        await this.previewButton.click();
    }

    async clickMentionInPreview() {
        await expect(this.previewArea).toBeVisible();
        await this.previewArea.locator('.mention-link').click();
    }

    async waitUntilFilePreviewContains(files: string[], timeout = duration.ten_sec) {
        await waitUntil(
            async () => {
                const previews = this.filePreview.getByTestId('file-preview-item');
                const details = this.filePreview.getByTestId('post-image-details');

                const [previewsCount, detailsCount] = await Promise.all([previews.count(), details.count()]);
                if (previewsCount !== files.length || detailsCount !== files.length) {
                    return false;
                }

                const previewTexts = await previews.allTextContents();
                return files.every((file) => previewTexts.some((text) => text.includes(file)));
            },
            {timeout},
        );
    }

    /**
     * The formatting bar holds the burn-on-read button while it is open.
     * The + menu holds the row while the bar is hidden.
     */
    private async burnOnReadControl() {
        if (await this.formattingBarOpen()) {
            return this.container.locator('#burnOnReadButton');
        }
        return this.burnOnReadButton;
    }

    /**
     * Toggle the burn-on-read feature for the message
     */
    async toggleBurnOnRead() {
        const wasOn = await this.burnOnReadLabel.isVisible();
        const barOpen = await this.formattingBarOpen();
        if (!barOpen) {
            await this.openPlusMenu();
        }
        const control = await this.burnOnReadControl();
        await expect(control).toBeEnabled();
        await control.click();

        // The menu runs this item's action after its close animation. Wait until the
        // label matches the new state so a later write is not overwritten by that action.
        if (wasOn) {
            await expect(this.burnOnReadLabel).toBeHidden();
        } else {
            await expect(this.burnOnReadLabel).toBeVisible();
        }
    }

    /**
     * Hidden means the control is not rendered. A disabled control would still be
     * attached and should not pass here.
     */
    async toHaveBurnOnReadHidden() {
        if (await this.formattingBarOpen()) {
            await expect(this.container.locator('#burnOnReadButton')).toHaveCount(0);
            return;
        }

        await this.openPlusMenu();
        await expect(this.burnOnReadButton).toHaveCount(0);
        await this.closePlusMenu();
    }

    async toHaveBurnOnReadVisible() {
        if (!(await this.formattingBarOpen())) {
            await this.openPlusMenu();
        }
        await expect(await this.burnOnReadControl()).toBeVisible();
    }

    async toHaveBurnOnReadLabel() {
        await expect(this.burnOnReadLabel).toBeVisible();
    }

    async toHaveNoBurnOnReadLabel() {
        await expect(this.burnOnReadLabel).not.toBeVisible();
    }

    /**
     * Check if burn-on-read is currently enabled
     * BoR is considered enabled if the label is visible above the input
     */
    async isBurnOnReadEnabled(): Promise<boolean> {
        return this.burnOnReadLabel.isVisible();
    }

    /**
     * Simulates pasting HTML (with a plain-text fallback) into the input, exercising Mattermost's
     * own paste-formatting logic (e.g. an HTML table auto-converting to a markdown table) rather
     * than just typing raw text.
     *
     * Dispatches a synthetic ClipboardEvent directly on the input: Playwright/CDP can't write
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
    async pasteHtml(html: string, plainText: string, {withoutFormatting = false}: {withoutFormatting?: boolean} = {}) {
        await expect(this.input).toBeVisible();
        await this.input.focus();

        await this.input.evaluate(
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
}
