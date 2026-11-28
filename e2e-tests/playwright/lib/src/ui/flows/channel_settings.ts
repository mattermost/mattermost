// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '../../aria/matchers';
import type {ChannelSettingsModal, ChannelSettingsModalMount} from '../generated';

export type ChannelSettings = ChannelSettingsModal<ChannelSettingsModalMount>;

/**
 * Closes the Channel Settings modal. With unsaved changes the first click only warns the user and keeps the modal open;
 * the second click closes it.
 */
export async function closeChannelSettings(settings: ChannelSettings): Promise<void> {
    // The first click may only warn about unsaved changes and keep the modal open; the retry clicks again.
    await expect(async () => {
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible({timeout: 1000});
    }).toPass({timeout: 15000});
}

/** Opens a tab of the Channel Settings modal and returns that tab's part of the modal. */
export async function openChannelSettingsInfoTab(settings: ChannelSettings): Promise<ChannelSettings['info']> {
    await settings.tabs.tab('info').select();
    await expect(settings.info.container).toBeVisible();
    return settings.info;
}

export async function openChannelSettingsConfigurationTab(
    settings: ChannelSettings,
): Promise<ChannelSettings['configuration']> {
    await settings.tabs.tab('configuration').select();
    await expect(settings.configuration.container).toBeVisible();
    return settings.configuration;
}

type Configuration = ChannelSettings['configuration'];

/** Types at the end of the banner text. */
export async function typeBannerText(configuration: Configuration, text: string): Promise<void> {
    const editor = configuration.bannerText.container.locator;

    // Click at the far right of the editor: a click in the middle lands on an attribute chip, which is not editable,
    // so the caret never reaches the end and the typed text is lost.
    const box = await editor.boundingBox();
    await editor.click(box ? {position: {x: box.width - 6, y: box.height / 2}} : undefined);
    await expect(editor).toBeFocused();
    await configuration.page.keyboard.press('End');
    await expect(editor).toBeFocused();
    await configuration.page.keyboard.type(text);
    await expect(editor).toContainText(text);
}

/**
 * Empties the banner text. Keyboard events and execCommand('delete') both honour contenteditable=false on the attribute
 * chips and refuse to remove them, so the editor's children are removed directly and an input event syncs the component.
 */
export async function clearBannerText(configuration: Configuration): Promise<void> {
    const editor = configuration.bannerText.container.locator;
    await editor.click();
    await expect(editor).toBeFocused();
    await editor.evaluate((el: HTMLElement) => {
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
        el.dispatchEvent(new InputEvent('input', {bubbles: true, cancelable: false}));
    });
    await expect(editor).toHaveText('');
}

/** Inserts an attribute into the banner text from the editor's attribute menu. */
export async function insertBannerToken(configuration: Configuration, field: {id: string} | string): Promise<void> {
    const {bannerText} = configuration;
    await bannerText.insertButton.click();
    await expect(bannerText.insertMenu.attributeList).not.toHaveKeyCount(0);
    const item =
        typeof field === 'string'
            ? await bannerText.insertMenu.attributeList.itemWith({text: field})
            : bannerText.insertMenu.attribute(field.id);
    await expect(item.container).toBeVisible();
    await item.container.click();
    await expect(item.container).not.toBeVisible();
}

/** Removes the attribute (shown by its label) from the banner text. */
export async function removeBannerToken(configuration: Configuration, label: string): Promise<void> {
    const {bannerText} = configuration;
    const token = await bannerText.tokenList.itemWith({text: label});
    await token.removeButton.click();

    // The editor outlives its tokens: an empty token list has no element to assert on.
    await expect(bannerText.container).not.toContainText(label);
}
