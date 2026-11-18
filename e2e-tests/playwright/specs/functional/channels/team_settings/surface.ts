// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {expect, type App, type PlaywrightExtended, DefaultChannel, Api, settle} from '@mattermost/playwright-lib';

/**
 * Team Settings on the generated page objects: the dialog's tabs, the membership tab (rules, auto-add, sync status,
 * its confirm and self-exclusion dialogs), the membership policies tab (list, editor, confirm and delete dialogs), and
 * the access tab (discoverability, mode-flip dialog).
 */

/** Logs the user in on the team's town square, waiting for the app to be up. */
export async function openTeam(pw: PlaywrightExtended, user: UserProfile, team: Team) {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    return app;
}

/** Opens Team Settings from the team menu. */
export async function openTeamSettings(app: App): Promise<App['teamSettingsModal']> {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.teamSettingsMenuItem);
    await app.lhs.teamMenu.teamSettingsMenuItem.click();
    const settings = app.teamSettingsModal;
    await expect(settings.tabs.tab('info')).toBeVisible();
    return settings;
}

/** Opens Team Settings on its membership tab. */
export async function openTeamMembershipTab(app: App): Promise<App['teamSettingsModal']> {
    const settings = await openTeamSettings(app);
    await settings.tabs.tab('team_membership').select();
    await expect(settings.membership).toBeVisible();
    return settings;
}

/** Opens Team Settings on its membership policies tab. */
export async function openAccessPoliciesTab(app: App): Promise<App['teamSettingsModal']> {
    const settings = await openTeamSettings(app);
    await settings.tabs.tab('access_policies').select();
    await expect(settings.accessPolicies.addPolicyButton).toBeVisible();
    return settings;
}

/** Opens Team Settings on its access tab. */
export async function openAccessTab(app: App): Promise<App['teamSettingsModal']> {
    const settings = await openTeamSettings(app);
    await settings.tabs.tab('access').select();
    await expect(settings.access.discoverability.privateButton).toBeVisible();
    return settings;
}

/**
 * Closes Team Settings. With unsaved changes (the save panel offering Save) the first click only warns; the second
 * closes. After a save the panel stays to say so, without Save, and one click closes. So click until it is gone.
 */
export async function closeTeamSettings(settings: App['teamSettingsModal']) {
    await expect(async () => {
        await settings.closeButton.click();
        await expect(settings.tabs.tab('info')).not.toBeVisible({timeout: 2000});
    }).toPass({timeout: 15_000});
}

/** Saves the open tab from its save panel. */
export async function save(settings: App['teamSettingsModal']) {
    const button = settings.savePanel.saveButton;
    await expect(button).toBeEnabled();
    await settle(button, {wait: Api.PatchTeam}).click();
}

/** A membership policy's row in the policies tab's list, by its name (rows are keyed by policy id). */
export async function policyRow(
    settings: App['teamSettingsModal'],
    name: string,
): Promise<ReturnType<App['teamSettingsModal']['accessPolicies']['policies']['row']>> {
    return settings.accessPolicies.policies.rowList.itemWith({text: name});
}

/** Matches an absent policy by name when there is no rendered row from which to resolve its id. */
export function policyRows(settings: App['teamSettingsModal'], name: string) {
    // A negative assertion cannot resolve a missing row through itemWith.
    return settings.accessPolicies.policies.rowList.locator.filter({hasText: name});
}

/** Assigns a channel to the policy being edited, through the channel selector dialog. */
export async function addChannel(
    app: App,
    editor: App['teamSettingsModal']['accessPolicies']['editor'],
    channel: {id: string},
) {
    await editor.addChannelsButton.click();
    const selector = app.channelSelectorModal;
    // The selector row handles click without an interactive role.
    const option = selector.channels.results.channel(channel).locator;
    await expect(option).toBeVisible();
    await option.click();
    await expect(selector.channels.remove(channel.id)).toBeVisible();
    await selector.channels.saveButton.click();

    // the channel is committed to the form only once the dialog has closed; a save before that races it
    await expect(selector.channels.saveButton).not.toBeVisible();
    await expect(editor.channels.row(channel.id)).toBeVisible();
}

/** Saves the policy being edited and confirms it in the "Save and apply policy" dialog. */
export async function applyPolicy(settings: App['teamSettingsModal']) {
    await settings.savePanel.saveButton.click();
    const confirm = settings.accessPolicies.editor.policyChangeModal;
    await expect(confirm.confirmButton).toHaveText(/Apply policy/);
    await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
    await expect(confirm.confirmButton).not.toBeVisible();
}
