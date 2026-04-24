// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

export const OBFUSCATED_SLUG_RE = /^[a-z0-9]{26}$/;

export async function skipIfNoAdvancedLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');
}

export async function setAnonymousUrls(adminClient: any, enabled: boolean) {
    await adminClient.patchConfig({
        PrivacySettings: {
            UseAnonymousURLs: enabled,
        },
    });
}

export function expectObfuscatedSlug(slug: string) {
    expect(slug).toMatch(OBFUSCATED_SLUG_RE);
}

export function expectReadableSlug(slug: string, expectedSlug?: string) {
    if (expectedSlug) {
        expect(slug).toBe(expectedSlug);
    }

    expect(slug).not.toMatch(OBFUSCATED_SLUG_RE);
}

export async function createChannelFromUI(channelsPage: any, displayName: string) {
    const newChannelModal = await channelsPage.openNewChannelModal();
    await newChannelModal.fillDisplayName(displayName);
    await newChannelModal.create();
    await channelsPage.toBeVisible();
}

export async function createTeamFromUI(channelsPage: any, displayName: string) {
    const createTeamForm = await channelsPage.openCreateTeamForm();
    await createTeamForm.fillTeamName(displayName);
    await createTeamForm.submitDisplayName();
    await channelsPage.toBeVisible();
}

export async function getChannelByDisplayName(adminClient: any, teamId: string, displayName: string) {
    const channels = await adminClient.getChannels(teamId);
    const channel = channels.find((candidate: any) => candidate.display_name === displayName);

    expect(channel).toBeDefined();

    return channel!;
}

export async function getTeamByDisplayName(adminClient: any, displayName: string) {
    const teams = await adminClient.getMyTeams();
    const team = teams.find((candidate: any) => candidate.display_name === displayName);

    expect(team).toBeDefined();

    return team!;
}

export async function createAnonymousUrlChannel(
    channelsPage: any,
    adminClient: any,
    teamName: string,
    teamId: string,
    displayName: string,
) {
    await createChannelFromUI(channelsPage, displayName);
    await channelsPage.centerView.header.toHaveTitle(displayName);

    const channel = await getChannelByDisplayName(adminClient, teamId, displayName);
    expectObfuscatedSlug(channel.name);
    await expect(channelsPage.page).toHaveURL(new RegExp(`/${teamName}/channels/${channel.name}$`));

    return channel;
}
