// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    attributeValue,
    clearBannerText as clearBannerTextFlow,
    typeBannerText as typeBannerTextFlow,
    openChannel as openChannelFlow,
    App,
    type AttributeLabels,
    type EditableAttributes,
    type ChannelSettings,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

/**
 * Channel attributes on the generated page objects. Labels (the channel header's, a thread's) are chips keyed by field
 * id; the editable block (Channel Info in the RHS, and the same editor in Channel Settings' Info tab) has rows keyed by
 * field id, whose values are chips keyed by value or a text value, edited inline through a text box or a menu. The
 * helpers specs elsewhere share are in the lib's flows; they're re-exported here for this folder's specs.
 */

export {
    labelChip,
    labelChips,
    openAttributeControl,
    openChannelInfo,
    openNewChannelModal,
    pickListOption,
} from '@mattermost/playwright-lib';

type Field = {id: string};
export type Labels = AttributeLabels;
export type Editable = EditableAttributes;

/** Logs the user in and opens the channel (a direct message by `@username`), waiting for the app to be up. */
export async function openChannel(pw: PlaywrightExtended, user: UserProfile, team: Team, channel: {name: string}) {
    return openChannelFlow(pw, user, {team, channel, path: channel.name.startsWith('@') ? 'messages' : 'channels'});
}

/** Opens a thread in global Threads (from the list, as a user would) and returns the view. */
export async function openGlobalThread(
    app: App,
    team: Team,
    root: {message: string},
): Promise<{threads: App['threads']}> {
    await app.threadsPage.goto({team});
    const {threads} = app;
    // Thread positions do not identify posts; find the thread by its root message in the generated feed.
    const item = await threads.feed.threadList.itemWith({text: root.message});
    await item.container.click();
    await expect(threads.pane.followButton).toBeVisible();
    return {threads};
}

/** Opens Channel Settings on its Info tab. */
export async function openChannelSettingsInfo(app: App): Promise<App['channelSettingsModal']> {
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const settings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    await settings.tabs.tab('info').select();
    await expect(settings.info.name.container).toBeVisible();
    return settings;
}

/** Opens a label row's overflow popover and returns it. */
export async function openOverflow(labels: Labels): Promise<Labels['overflowPopover']> {
    await labels.overflowButton.click();
    const popover = labels.overflowPopover;
    await expect(popover).toBeVisible();
    return popover;
}

/** A field's row in the editable block. */
export function row(attributes: Editable, field: Field): ReturnType<Editable['attribute']> {
    return attributes.attribute(field);
}

/** A row's first value: its first chip (select fields; chips are keyed by value) or its text value. */
export async function chip(attributes: Editable, field: Field): ReturnType<typeof attributeValue> {
    return attributeValue(attributes, field);
}

/** A text field's inline editor. */
export function editor(attributes: Editable, field: Field) {
    return row(attributes, field).editorTextbox;
}

export async function startEditing(attributes: Editable, field: Field) {
    const r = row(attributes, field);
    await r.editButton.click();
    await expect
        .poll(
            async () =>
                (await r.editorTextbox.isVisible()) ||
                (await new App(r.page).channelAttributeEditMenu.optionList.keys()).length > 0,
        )
        .toBe(true);
}

/**
 * Only Escape is guaranteed to close the editor: a commit closes it on a successful write and deliberately keeps it
 * open on a failed one, so callers assert the outcome they expect.
 */
export async function setText(
    app: App,
    attributes: Editable,
    field: Field,
    text: string,
    commit: 'enter' | 'blur' | 'escape' = 'enter',
) {
    await startEditing(attributes, field);
    const input = editor(attributes, field);
    await input.fill(text);

    if (commit === 'enter') {
        await input.press('Enter');
    } else if (commit === 'escape') {
        await input.press('Escape');
        await expect(input).not.toBeVisible();
    } else {
        await app.page.mouse.click(0, 0);
    }
    await expect
        .poll(async () => !(await input.isVisible()) || row(attributes, field).errorAlert.isVisible())
        .toBe(true);
}

/** Picks an option by name from an open attribute menu; a select field then shows the option as its chip. */
export async function pickOption(attributes: Editable, field: Field, option: string) {
    const exact = new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const r = row(attributes, field);
    await (await new App(r.page).channelAttributeEditMenu.optionList.itemWith({text: exact})).click();
    await expect(r.chipList).not.toHaveKeyCount(0);
    await r.chipList.itemWith({text: exact});
}

/** Opens a select field's menu and picks the option (the editor of a select is its first option, so not clicked). */
export async function select(_app: App, attributes: Editable, field: Field, option: string) {
    await startEditing(attributes, field);
    await pickOption(attributes, field, option);
}

/** Removes a selected option with its chip's remove control (which doesn't open the menu). */
export async function deselect(attributes: Editable, field: Field, option: string) {
    const value = await row(attributes, field).chipList.itemWith({text: option});
    await value.removeButton.click();
    // Chip keys are positions, so match the removed label after the remaining chips shift.
    const exact = new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    await expect(row(attributes, field).chipList.locator.filter({hasText: exact})).toHaveCount(0);
}

/** Adds an unset attribute from the block's Add menu and returns its row. */
async function addAttribute(attributes: Editable, field: Field) {
    await attributes.addButton.click();
    await expect(attributes.addMenu.attribute(field)).toBeVisible();
    await attributes.addMenu.attribute(field).click();
    await expect(attributes.addMenu.attribute(field)).not.toBeVisible();
    return row(attributes, field);
}

/** Adds an unset text attribute from the block's Add menu; its input opens as soon as it is added. */
export async function addText(attributes: Editable, field: Field) {
    const r = await addAttribute(attributes, field);
    await expect(r.editorTextbox).toBeVisible();
}

/** Adds an unset select attribute: it lands as a closed "Not set" row, so its menu is opened, then the option is picked. */
export async function addSelect(attributes: Editable, field: Field, option: string) {
    const r = await addAttribute(attributes, field);
    await expect(r.unsetText).toBeVisible();
    await r.editButton.click();
    await expect(new App(r.page).channelAttributeEditMenu.optionList).not.toHaveKeyCount(0);
    await pickOption(attributes, field, option);
}

type Configuration = ChannelSettings['configuration'];

/** Opens Channel Settings on its Configuration tab. */
export async function openChannelSettingsConfiguration(app: App): Promise<App['channelSettingsModal']> {
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const settings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    await settings.tabs.tab('configuration').select();
    await expect(settings.configuration.bannerSwitch).toBeVisible();
    return settings;
}

/** The attribute names of the banner text's tokens, in order (tokens are keyed by position; `data-token` names them). */
export async function bannerTokenNames(config: Configuration): Promise<string[]> {
    const names: string[] = [];
    for (const key of await config.bannerText.tokenList.keys()) {
        names.push((await config.bannerText.token(Number(key)).locator.getAttribute('data-token')) ?? '');
    }
    return names;
}

/** The banner text's token for an attribute, by its name. */
export async function bannerToken(
    config: Configuration,
    name: string,
): Promise<ReturnType<Configuration['bannerText']['token']>> {
    await expect.poll(() => bannerTokenNames(config)).toContain(name);
    return config.bannerText.token((await bannerTokenNames(config)).indexOf(name));
}

/** Inserts an attribute's token from the banner text's Insert menu. */
export async function insertBannerToken(config: Configuration, field: {id: string; name: string}) {
    await config.bannerText.insertButton.click();
    await expect(config.bannerText.insertMenu.attribute(field).container).toBeVisible();
    await config.bannerText.insertMenu.attribute(field).container.click();
    await expect.poll(() => bannerTokenNames(config)).toContain(field.name);
}

/** Removes an attribute's token from the banner text. */
export async function removeBannerToken(config: Configuration, name: string) {
    await (await bannerToken(config, name)).removeButton.click();
    await expect.poll(() => bannerTokenNames(config)).not.toContain(name);
}

/** Types at the end of the banner text editor. */
export async function typeBannerText(_app: App, config: Configuration, text: string) {
    await typeBannerTextFlow(config, text);
}

/**
 * Empties the banner text editor. Keyboard deletes and execCommand('delete') both honour contenteditable=false on the
 * token chips and refuse to remove them; removing the DOM nodes and dispatching an input event syncs the component.
 */
export async function clearBannerText(config: Configuration) {
    await clearBannerTextFlow(config);
}

/** Sets the banner colour (a hex value, with or without `#`). */
export async function setBannerColor(config: Configuration, color: string) {
    const value = config.bannerColor.valueTextbox;
    await value.fill(color.replace('#', ''));
    await expect(value).toHaveValue(new RegExp(`^#?${color.replace('#', '')}$`, 'i'));
}

/** `#RRGGBB` as the browser reports a computed colour. */
function rgb(hex: string) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Checks a channel banner's text and background colour. */
export async function expectBanner(
    banner: App['center']['channelBanner'] | App['rhs']['thread']['channelBanner'],
    text: string,
    color: string,
) {
    await expect(banner.textText).toHaveText(text);
    await expect(banner).toHaveCSS('background-color', rgb(color));
}
