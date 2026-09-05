// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {
    expect,
    getRandomId,
    hasSharedChannelsLicense,
    MockRemoteClusterServer,
    postRemoteClusterConfirmInviteFromPeer,
    test,
    type PostRemoteClusterConfirmInviteFromPeerResult,
} from '@mattermost/playwright-lib';

/*
 * Shared channel invitations in the product UI (real Mattermost REST only — no browser API stubbing).
 *
 * Use the `page` returned from `pw.testBrowser.login` (or `channelsPage.page` / `systemConsolePage.page`) for
 * navigations — not the Playwright fixture `page`, which is a different browser context and is not logged in.
 * Call `skipDesktopDeepLinkingPrompt` on that tab so the desktop deep-linking screen is skipped.
 */

/** Same intent as `pw.hasSeenLandingPage`, but must run on the tab returned from `testBrowser.login` (see file comment). */
async function skipDesktopDeepLinkingPrompt(appPage: Page): Promise<void> {
    await appPage.goto('/');
    await appPage.evaluate(() => {
        localStorage.setItem('__landingPageSeen__', 'true');
    });
}

/**
 * Mirrors `baseGlobalSetup` / `createNewUserProfile` tutorial prefs so CRT / threads onboarding
 * does not block channel UI. `initSetup` resets server config; re-applying avoids flaky popovers.
 */
async function suppressAdminThreadsAndOnboardingTutorials(adminClient: Client4, adminUserId: string): Promise<void> {
    const preferences: PreferenceType[] = [
        {user_id: adminUserId, category: 'tutorial_step', name: adminUserId, value: '999'},
        {user_id: adminUserId, category: 'crt_thread_pane_step', name: adminUserId, value: '999'},
        {user_id: adminUserId, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: adminUserId, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        {user_id: adminUserId, category: 'onboarding', name: 'complete', value: 'true'},
    ];
    await adminClient.savePreferences(adminUserId, preferences);
}

/** Same pattern as `ContentReviewDmPage.waitForRHSVisible` — CRT intro uses `collapsed_reply_threads_modal.confirm` ("Got it"). */
async function dismissCrtIntroModalIfPresent(appPage: Page): Promise<void> {
    const gotIt = appPage.getByRole('button', {name: 'Got it'});
    try {
        await gotIt.waitFor({state: 'visible', timeout: 5000});
        await gotIt.click();
    } catch {
        // no blocking modal
    }
}

async function enableConnectedWorkspaces(adminClient: {
    patchConfig: (patch: Record<string, unknown>) => Promise<unknown>;
}): Promise<void> {
    await adminClient.patchConfig({
        ConnectedWorkspacesSettings: {
            EnableSharedChannels: true,
            EnableRemoteClusterService: true,
        },
    });
}

/** Admin Console create-connection flow + programmatic mock peer `confirm_invite`; configures mock inbound auth. */
async function createConfirmedMockRemoteConnection(
    appPage: Page,
    mock: MockRemoteClusterServer,
    team: {display_name: string},
    orgDisplayName: string,
    peerSiteUrl: string,
): Promise<PostRemoteClusterConfirmInviteFromPeerResult> {
    await appPage.goto('/admin_console/site_config/secure_connections');

    await appPage.getByRole('button', {name: 'Add a connection'}).first().click();
    await appPage.getByRole('menuitem', {name: 'Create a connection'}).click();

    await expect(appPage).toHaveURL(/\/secure_connections\/create/);

    await appPage.getByTestId('organization-name-input').fill(orgDisplayName);
    await appPage.getByTestId('destination-team-input').click();
    await appPage.getByRole('option', {name: team.display_name}).click();

    await appPage.getByRole('button', {name: 'Save'}).click();

    const inviteInput = appPage.getByTestId('invite-code');
    await expect(inviteInput).toHaveValue(/.+/);
    const inviteBase64 = await inviteInput.inputValue();
    const password = await appPage.getByTestId('password').inputValue();

    await appPage.getByRole('button', {name: 'Done'}).click();

    const handshake = await postRemoteClusterConfirmInviteFromPeer({
        inviteBase64,
        password,
        peerSiteUrl,
    });

    mock.setInboundExpectedAuth({
        remoteId: handshake.originRemoteId,
        token: handshake.peerOutboundToken,
    });

    return handshake;
}

/**
 * Outgoing invite + remote `FAIL` body is persisted as `failed` with `error` = remote `err`
 * (`markInvitationFailedByID` / `SharedChannelInvitationsTable` Details column).
 */
async function expectPollInvitationFailedWithError(
    listInvitations: () => Promise<SharedChannelInvitation[] | undefined>,
    expectedError: string,
): Promise<void> {
    await expect
        .poll(
            async () => {
                const rows = (await listInvitations()) ?? [];
                return rows.some((r) => r.status === 'failed' && r.error === expectedError);
            },
            {timeout: 60_000},
        )
        .toBe(true);
}

test.describe('Shared channel invitations', () => {
    test.describe('Admin Console — secure connection detail', () => {
        test('invitation activity section shows empty state and can be collapsed', async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup();
            await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

            const license = await adminClient.getClientLicenseOld();
            test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

            await enableConnectedWorkspaces(adminClient);

            const orgDisplayName = `Invitations Org ${getRandomId()}`;

            const {page: appPage} = await pw.testBrowser.login(adminUser);
            await skipDesktopDeepLinkingPrompt(appPage);
            await appPage.goto('/admin_console/site_config/secure_connections');

            await appPage.getByRole('button', {name: 'Add a connection'}).first().click();
            await appPage.getByRole('menuitem', {name: 'Create a connection'}).click();

            await expect(appPage).toHaveURL(/\/secure_connections\/create/);

            await appPage.getByTestId('organization-name-input').fill(orgDisplayName);
            await appPage.getByTestId('destination-team-input').click();
            await appPage.getByRole('option', {name: team.display_name}).click();

            await appPage.getByRole('button', {name: 'Save'}).click();

            await expect(appPage).not.toHaveURL(/\/secure_connections\/create/);

            // Create flow opens `SecureConnectionCreateInviteModal` ("Connection created"); dismiss so it does not cover the detail page.
            const postCreateInviteInput = appPage.getByTestId('invite-code');
            await expect(postCreateInviteInput).toHaveValue(/.+/);
            await appPage.getByRole('button', {name: 'Done'}).click();

            await expect(appPage.getByTestId('shared_channels_section')).toBeVisible();

            await appPage.getByRole('button', {name: 'Show or hide invitation activity'}).click();

            await expect(
                appPage.getByText('There are no stored invitation records for this connection.'),
            ).toBeVisible();

            await appPage.getByRole('button', {name: 'Show or hide invitation activity'}).click();

            await expect(appPage.getByText('There are no stored invitation records for this connection.')).toHaveCount(
                0,
            );

            await appPage.locator('a.back').click();

            const connectionRow = appPage.getByRole('link', {name: orgDisplayName});
            await expect(connectionRow).toBeVisible();

            await connectionRow.getByRole('button', {name: `Connection options for ${orgDisplayName}`}).click();

            await appPage.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();

            await appPage
                .getByRole('dialog', {name: 'Delete secure connection'})
                .getByRole('button', {name: 'Yes, delete'})
                .click();

            await expect(connectionRow).toHaveCount(0);
        });
    });

    test.describe('Admin Console + mock peer — invitation lifecycle', () => {
        test.setTimeout(180_000);

        test('pending invitation clears after mock accepts shared-channel invite', async ({pw}) => {
            const mock = new MockRemoteClusterServer();
            await mock.start();

            const peerSiteUrl = process.env.PW_MOCK_PEER_PUBLIC_URL ?? mock.baseUrl;

            let remoteId: string | undefined;
            let cleanupAdmin: Client4 | undefined;

            try {
                const {adminUser, adminClient, team} = await pw.initSetup();
                cleanupAdmin = adminClient;
                await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

                const license = await adminClient.getClientLicenseOld();
                test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

                await enableConnectedWorkspaces(adminClient);

                const orgDisplayName = `Mock Peer Org ${getRandomId()}`;
                const channelName = `sc-inv-mock-${getRandomId()}`;
                const channel = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'SC Mock Peer Invite',
                    type: 'O',
                });

                const {page: appPage} = await pw.testBrowser.login(adminUser);
                await skipDesktopDeepLinkingPrompt(appPage);

                const handshake = await createConfirmedMockRemoteConnection(
                    appPage,
                    mock,
                    team,
                    orgDisplayName,
                    peerSiteUrl,
                );
                remoteId = handshake.originRemoteId;

                mock.beginHoldNextSharedChannelInvite();

                await adminClient.sharedChannelRemoteInvite(handshake.originRemoteId, channel.id);

                await appPage.goto(`/admin_console/site_config/secure_connections/${handshake.originRemoteId}`);

                await appPage.getByRole('button', {name: 'Show or hide invitation activity'}).click();

                const invitationsTable = appPage.getByRole('table', {
                    name: 'Shared channel invitations for this connection',
                });
                await expect(invitationsTable.getByRole('cell', {name: 'Pending'})).toBeVisible();

                mock.releaseHeldSharedChannelInvite();

                await expect
                    .poll(
                        async () => {
                            const rows = await adminClient.getSharedChannelInvitationsByRemote(
                                handshake.originRemoteId,
                                0,
                                500,
                            );
                            return rows?.filter((r) => r.status === 'pending').length ?? 0;
                        },
                        {timeout: 60_000},
                    )
                    .toBe(0);

                await appPage.reload();

                await appPage.getByRole('button', {name: 'Show or hide invitation activity'}).click();

                await expect(
                    appPage.getByText('There are no stored invitation records for this connection.'),
                ).toBeVisible();
            } finally {
                if (remoteId && cleanupAdmin) {
                    try {
                        await cleanupAdmin.deleteRemoteCluster(remoteId);
                    } catch {
                        // best-effort cleanup
                    }
                }
                await mock.stop();
            }
        });
    });

    test.describe('Admin Console + mock peer — remote declines invite', () => {
        test.setTimeout(180_000);

        test('invitation table shows remote error after peer returns FAIL for shared-channel invite', async ({pw}) => {
            const mock = new MockRemoteClusterServer();
            await mock.start();

            const peerSiteUrl = process.env.PW_MOCK_PEER_PUBLIC_URL ?? mock.baseUrl;
            const remoteErr = `mock-peer-decline-${getRandomId()}`;

            let remoteId: string | undefined;
            let cleanupAdmin: Client4 | undefined;

            try {
                const {adminUser, adminClient, team} = await pw.initSetup();
                cleanupAdmin = adminClient;
                await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

                const license = await adminClient.getClientLicenseOld();
                test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

                await enableConnectedWorkspaces(adminClient);

                const orgDisplayName = `Mock decline org ${getRandomId()}`;
                const channelName = `sc-inv-decline-${getRandomId()}`;
                const channel = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'SC Mock Decline',
                    type: 'O',
                });

                const {page: appPage} = await pw.testBrowser.login(adminUser);
                await skipDesktopDeepLinkingPrompt(appPage);

                const handshake = await createConfirmedMockRemoteConnection(
                    appPage,
                    mock,
                    team,
                    orgDisplayName,
                    peerSiteUrl,
                );
                remoteId = handshake.originRemoteId;

                mock.enqueueNextSharedChannelInviteMsg({accept: false, err: remoteErr});

                await adminClient.sharedChannelRemoteInvite(handshake.originRemoteId, channel.id);

                await expectPollInvitationFailedWithError(
                    () => adminClient.getSharedChannelInvitationsByRemote(handshake.originRemoteId, 0, 500),
                    remoteErr,
                );

                await appPage.goto(`/admin_console/site_config/secure_connections/${handshake.originRemoteId}`);

                await appPage.getByRole('button', {name: 'Show or hide invitation activity'}).click();

                const invitationsTable = appPage.getByRole('table', {
                    name: 'Shared channel invitations for this connection',
                });
                await expect(invitationsTable.getByRole('cell', {name: 'Failed'})).toBeVisible();
                await expect(invitationsTable.getByText(remoteErr)).toBeVisible();
            } finally {
                if (remoteId && cleanupAdmin) {
                    try {
                        await cleanupAdmin.deleteRemoteCluster(remoteId);
                    } catch {
                        // best-effort cleanup
                    }
                }
                await mock.stop();
            }
        });
    });

    test.describe('Channel Settings + mock peer — invitation lifecycle', () => {
        test.setTimeout(180_000);

        test('pending invitation clears in channel settings after mock accepts shared-channel invite', async ({pw}) => {
            const mock = new MockRemoteClusterServer();
            await mock.start();

            const peerSiteUrl = process.env.PW_MOCK_PEER_PUBLIC_URL ?? mock.baseUrl;

            let remoteId: string | undefined;
            let cleanupAdmin: Client4 | undefined;

            try {
                const {adminUser, adminClient, team} = await pw.initSetup();
                cleanupAdmin = adminClient;
                await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

                const license = await adminClient.getClientLicenseOld();
                test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

                await enableConnectedWorkspaces(adminClient);

                const orgDisplayName = `Ch mock org ${getRandomId()}`;
                const channelName = `sc-ch-mock-${getRandomId()}`;
                const channel = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'SC Ch Mock Invite',
                    type: 'O',
                });

                const {page: appPage} = await pw.testBrowser.login(adminUser);
                await skipDesktopDeepLinkingPrompt(appPage);

                const handshake = await createConfirmedMockRemoteConnection(
                    appPage,
                    mock,
                    team,
                    orgDisplayName,
                    peerSiteUrl,
                );
                remoteId = handshake.originRemoteId;

                mock.beginHoldNextSharedChannelInvite();

                await adminClient.sharedChannelRemoteInvite(handshake.originRemoteId, channel.id);

                await appPage.goto(`/${team.name}/channels/${channelName}`);
                await dismissCrtIntroModalIfPresent(appPage);

                await appPage.locator('#channelHeaderDropdownButton').click();
                await appPage.getByText('Channel Settings').click();

                await expect(appPage.locator('.ChannelSettingsModal')).toBeVisible();
                await appPage.getByTestId('configuration-tab-button').click();

                await appPage.getByRole('button', {name: 'Show or hide invitation activity for this channel'}).click();

                const invitationsTable = appPage.locator('.channel_shared_invitations_panel').getByRole('table', {
                    name: 'Shared channel invitations for this connection',
                });
                await expect(invitationsTable.getByRole('cell', {name: 'Pending'})).toBeVisible();

                mock.releaseHeldSharedChannelInvite();

                await expect
                    .poll(
                        async () => {
                            const rows = await adminClient.getSharedChannelInvitationsByChannel(channel.id, 0, 500);
                            return rows?.filter((r) => r.status === 'pending').length ?? 0;
                        },
                        {timeout: 60_000},
                    )
                    .toBe(0);

                await appPage.reload();
                await dismissCrtIntroModalIfPresent(appPage);

                await appPage.locator('#channelHeaderDropdownButton').click();
                await appPage.getByText('Channel Settings').click();

                await expect(appPage.locator('.ChannelSettingsModal')).toBeVisible();
                await appPage.getByTestId('configuration-tab-button').click();

                await appPage.getByRole('button', {name: 'Show or hide invitation activity for this channel'}).click();

                await expect(
                    appPage.getByText(
                        'There are no stored invitation records for this channel. Pending rows clear after success; failed invitations appear here.',
                    ),
                ).toBeVisible();
            } finally {
                if (remoteId && cleanupAdmin) {
                    try {
                        await cleanupAdmin.deleteRemoteCluster(remoteId);
                    } catch {
                        // best-effort cleanup
                    }
                }
                await mock.stop();
            }
        });
    });

    test.describe('Channel Settings + mock peer — remote declines invite', () => {
        test.setTimeout(180_000);

        test('invitation table shows remote error after peer returns FAIL for shared-channel invite', async ({pw}) => {
            const mock = new MockRemoteClusterServer();
            await mock.start();

            const peerSiteUrl = process.env.PW_MOCK_PEER_PUBLIC_URL ?? mock.baseUrl;
            const remoteErr = `mock-ch-decline-${getRandomId()}`;

            let remoteId: string | undefined;
            let cleanupAdmin: Client4 | undefined;

            try {
                const {adminUser, adminClient, team} = await pw.initSetup();
                cleanupAdmin = adminClient;
                await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

                const license = await adminClient.getClientLicenseOld();
                test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

                await enableConnectedWorkspaces(adminClient);

                const orgDisplayName = `Ch mock decline ${getRandomId()}`;
                const channelName = `sc-ch-decline-${getRandomId()}`;
                const channel = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'SC Ch Mock Decline',
                    type: 'O',
                });

                const {page: appPage} = await pw.testBrowser.login(adminUser);
                await skipDesktopDeepLinkingPrompt(appPage);

                const handshake = await createConfirmedMockRemoteConnection(
                    appPage,
                    mock,
                    team,
                    orgDisplayName,
                    peerSiteUrl,
                );
                remoteId = handshake.originRemoteId;

                mock.enqueueNextSharedChannelInviteMsg({accept: false, err: remoteErr});

                await adminClient.sharedChannelRemoteInvite(handshake.originRemoteId, channel.id);

                await expectPollInvitationFailedWithError(
                    () => adminClient.getSharedChannelInvitationsByChannel(channel.id, 0, 500),
                    remoteErr,
                );

                await appPage.goto(`/${team.name}/channels/${channelName}`);
                await dismissCrtIntroModalIfPresent(appPage);

                await appPage.locator('#channelHeaderDropdownButton').click();
                await appPage.getByText('Channel Settings').click();

                await expect(appPage.locator('.ChannelSettingsModal')).toBeVisible();
                await appPage.getByTestId('configuration-tab-button').click();

                await appPage.getByRole('button', {name: 'Show or hide invitation activity for this channel'}).click();

                const invitationsTable = appPage.locator('.channel_shared_invitations_panel').getByRole('table', {
                    name: 'Shared channel invitations for this connection',
                });
                await expect(invitationsTable.getByRole('cell', {name: 'Failed'})).toBeVisible();
                await expect(invitationsTable.getByText(remoteErr)).toBeVisible();
            } finally {
                if (remoteId && cleanupAdmin) {
                    try {
                        await cleanupAdmin.deleteRemoteCluster(remoteId);
                    } catch {
                        // best-effort cleanup
                    }
                }
                await mock.stop();
            }
        });
    });

    test.describe('Channel Settings — configuration tab', () => {
        test('invitation activity shows empty state for the channel', async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup();
            await suppressAdminThreadsAndOnboardingTutorials(adminClient, adminUser.id);

            const license = await adminClient.getClientLicenseOld();
            test.skip(!hasSharedChannelsLicense(license), 'Shared Channels license required');

            await enableConnectedWorkspaces(adminClient);

            const channelName = `sc-inv-empty-${getRandomId()}`;
            await adminClient.createChannel({
                team_id: team.id,
                name: channelName,
                display_name: 'SC Invites Empty',
                type: 'O',
            });

            const {page: appPage} = await pw.testBrowser.login(adminUser);
            await skipDesktopDeepLinkingPrompt(appPage);
            await appPage.goto(`/${team.name}/channels/${channelName}`);
            await dismissCrtIntroModalIfPresent(appPage);

            await appPage.locator('#channelHeaderDropdownButton').click();
            await appPage.getByText('Channel Settings').click();

            await expect(appPage.locator('.ChannelSettingsModal')).toBeVisible();
            await appPage.getByTestId('configuration-tab-button').click();

            await appPage.getByRole('button', {name: 'Show or hide invitation activity for this channel'}).click();

            await expect(appPage.locator('.channel_shared_invitations_panel')).toBeVisible();

            await expect(
                appPage.getByText(
                    'There are no stored invitation records for this channel. Pending rows clear after success; failed invitations appear here.',
                ),
            ).toBeVisible();
        });
    });
});
