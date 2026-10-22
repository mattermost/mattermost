// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Coverage for MM-68952 / PR #36815 — per-viewer resolution of `~channel` mentions.
 *
 * The server populates `post.props.channel_mentions` for the post creator, then strips it
 * per-viewer using `HasPermissionToResolveChannelMention`. The webapp only renders a clickable
 * `a.mention-link` (display name) when the viewer's `channel_mentions` still contains the channel;
 * otherwise it renders the literal `~slug` text.
 *
 * `HasPermissionToResolveChannelMention` resolves PUBLIC channels for any team member (independent
 * of Compliance Monitoring), but keeps PRIVATE/DM/GM and cross-team channels stripped.
 */
test.describe('channel mention resolution', () => {
    /**
     * @objective A public channel mention authored on one team renders as the raw `~slug`
     * (unresolved, non-clickable) for a viewer who does not belong to that channel's team.
     *
     * @precondition The viewer shares only a DM with the author and never joins the author's team.
     *
     * This is the license-free half of the fix (cross-team disclosure stays prevented) and is the
     * simplest scenario whose rendering differs from the pre-fix behavior without Compliance Monitoring.
     */
    test(
        'keeps a cross-team public channel mention unresolved for a non-team viewer',
        {tag: '@mentions'},
        async ({pw}) => {
            // # Initialize the author on team A
            const {adminClient, user: author, userClient, team: teamA} = await pw.initSetup();

            // # Create a public channel on team A with a display name distinct from its slug, so a
            // resolved mention (display name) is clearly distinguishable from an unresolved one (slug)
            const channelName = `cross-team-public-${pw.random.id()}`;
            const channelDisplayName = 'Cross Team Secret';
            const publicChannel = await adminClient.createChannel({
                team_id: teamA.id,
                name: channelName,
                display_name: channelDisplayName,
                type: 'O',
            });
            await adminClient.addToChannel(author.id, publicChannel.id);

            // # Create a viewer that belongs only to a different team B (never to team A)
            const viewer = await pw.createNewUserProfile(adminClient);
            const teamB = await pw.createNewTeam(adminClient);
            await adminClient.addToTeam(teamB.id, viewer.id);

            // # Open a DM between author and viewer (DMs are the only cross-team-visible channel)
            const dmChannel = await adminClient.createDirectChannel([author.id, viewer.id]);

            // # Author posts the public channel mention into the DM. current_team_id scopes the
            // server-side name lookup to team A so the mention resolves for the author at creation time.
            await userClient.createPost({
                channel_id: dmChannel.id,
                message: `Check out ~${channelName}`,
                user_id: author.id,
                props: {current_team_id: teamA.id},
            });

            // # Log in as the viewer and open the DM via team B
            const {channelsPage} = await pw.testBrowser.login(viewer);
            await channelsPage.goto(teamB.name, `@${author.username}`);
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();

            // * The mention is NOT resolved into a clickable channel link for the cross-team viewer
            await expect(lastPost.body.locator('a.mention-link[data-channel-mention]')).toHaveCount(0);

            // * The raw `~slug` is rendered as plain text and the display name is never disclosed
            await expect(lastPost.body).toContainText(`~${channelName}`);
            await expect(lastPost.body).not.toContainText(channelDisplayName);
        },
    );

    /**
     * @objective With Compliance Monitoring enabled, a public channel mention resolves into a
     * clickable `a.mention-link` (display name) for a team member who is NOT a member of the channel.
     *
     * @precondition Enterprise license + Compliance Monitoring. This is the exact regression from
     * MM-68952: before the fix the per-viewer permission check (HasPermissionToReadChannel) failed
     * under Compliance for non-members, so the mention was stripped to the raw `~slug`.
     */
    test(
        'resolves a public channel mention for a non-member team member when Compliance Monitoring is on',
        {tag: '@mentions'},
        async ({pw}) => {
            // Requires an enterprise license; skipped on unlicensed servers (e.g. local dev).
            await pw.skipIfNoLicense();

            const {adminClient, user: author, userClient, team} = await pw.initSetup();

            // NOTE: ComplianceSettings is a global, server-wide setting. Toggling it can affect other
            // tests running in parallel; we restore it in a finally block to limit the blast radius.
            await adminClient.patchConfig({ComplianceSettings: {Enable: true}});

            try {
                // # Create a public channel; the author is a member, the viewer will not be
                const channelName = `compliance-public-${pw.random.id()}`;
                const channelDisplayName = 'Compliance Public Channel';
                const publicChannel = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: channelDisplayName,
                    type: 'O',
                });
                await adminClient.addToChannel(author.id, publicChannel.id);

                // # Create a viewer who is a team member but NOT a member of the public channel
                const viewer = await pw.createNewUserProfile(adminClient);
                await adminClient.addToTeam(team.id, viewer.id);

                // # Author posts the mention in town-square (both users are members)
                const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
                await userClient.createPost({
                    channel_id: townSquare.id,
                    message: `Please see ~${channelName}`,
                    user_id: author.id,
                });

                // # Log in as the viewer and open town-square
                const {channelsPage} = await pw.testBrowser.login(viewer);
                await channelsPage.goto(team.name, 'town-square');
                await channelsPage.toBeVisible();

                const lastPost = await channelsPage.getLastPost();

                // * The mention resolves to a clickable channel link showing the display name
                const mentionLink = lastPost.body.locator(`a.mention-link[data-channel-mention="${channelName}"]`);
                await expect(mentionLink).toBeVisible();
                await expect(mentionLink).toContainText(channelDisplayName);
            } finally {
                await adminClient.patchConfig({ComplianceSettings: {Enable: false}});
            }
        },
    );
});
