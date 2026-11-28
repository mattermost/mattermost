// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {expect, type App, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

export const FLAG_REASON = 'Classification mismatch';

export async function setupContentFlagging(
    adminClient: Client4,
    userIds: string[],
    enable = true,
    hideFlaggedContent = true,
) {
    // Configure content flagging
    await adminClient.saveContentFlaggingConfig({
        EnableContentFlagging: enable,
        NotificationSettings: {
            EventTargetMapping: {
                assigned: ['reviewers', 'author'],
                dismissed: ['reporter', 'author', 'reviewers'],
                flagged: ['reviewers', 'author'],
                removed: ['author', 'reporter', 'reviewers'],
            },
        },
        ReviewerSettings: {
            CommonReviewers: true,
            CommonReviewerIds: userIds,
            TeamReviewersSetting: {},
            SystemAdminsAsReviewers: true,
            TeamAdminsAsReviewers: true,
        },
        AdditionalSettings: {
            Reasons: [FLAG_REASON, 'Need-to-know violation', 'Unauthorized disclosure', 'Other'],
            ReporterCommentRequired: true,
            ReviewerCommentRequired: true,
            HideFlaggedContent: hideFlaggedContent,
        },
    } as Parameters<Client4['saveContentFlaggingConfig']>[0]);
    return adminClient;
}

/** Posts `message` as the user in the team's Town Square. */
export async function createPost(
    adminClient: Client4,
    userClient: Client4,
    team: Team,
    user: UserProfile,
    message: string,
) {
    const townSquare = await adminClient.getChannelByName(team.id, DefaultChannel.TownSquare);
    const post = await userClient.createPost({
        channel_id: townSquare.id,
        message,
        user_id: user.id,
    } as Parameters<Client4['createPost']>[0]);

    return {post, message, townSquare};
}

/** Opens the user's DM with the content-review bot and waits for its posts. */
export async function openContentReview(app: App, team: {name: string}) {
    await app.channelsPage.goto({team, path: 'messages', channel: '@content-review'});
    await expect.poll(async () => (await app.center.postList.postList.keys()).length).toBeGreaterThan(0);
}

/**
 * The id of the report post the content-review bot sent `reviewer` about the flagged post (the report carries the
 * flagged post's id in its props), waiting for it to arrive.
 */
export async function reportPostId(pw: PlaywrightExtended, reviewer: UserProfile, flaggedPostId: string) {
    const {client} = await pw.makeClient(reviewer);

    // the reviewer may be a profile from pw.random.user(), which has no id until created: ask the session
    const me = await client.getMe();
    const bot = await client.getUserByUsername('content-review');
    const dm = await client.createDirectChannel([me.id, bot.id]);
    let id = '';
    await expect
        .poll(async () => {
            const {posts} = await client.getPosts(dm.id, 0, 60);
            id = Object.values(posts).find((p) => p.props?.reported_post_id === flaggedPostId)?.id ?? '';
            return id;
        })
        .not.toBe('');
    return id;
}

/** The report card in the content-review DM (center) or in the RHS thread. */
export function reportCard(
    app: App,
    reportId: string,
    where: 'center' | 'rhs' = 'center',
):
    | ReturnType<App['center']['postList']['post']>['spillageReport']['card']
    | ReturnType<App['rhs']['thread']['post']>['spillageReport']['card'] {
    const post = where === 'center' ? app.center.postList.post({id: reportId}) : app.rhs.thread.post({id: reportId});
    return post.spillageReport.card;
}

/** Checks a report card's status, reason and quoted message. */
export async function expectReport(
    card: ReturnType<typeof reportCard>,
    {status, reason = FLAG_REASON, message}: {status: string; reason?: string; message: string},
) {
    await expect(card.field({name: 'status'}).value.selectText).toHaveText(status);
    await expect(card.field({name: 'reporting_reason'}).value.selectText).toHaveText(reason);
    await expect(card.field({name: 'post_preview'}).value.postPreview.post.message.container).toHaveText(message);
}

/**
 * As `reviewer`, opens the content-review DM and checks the report about the flagged post: its status, the reason
 * and the quoted message.
 */
export async function verifyReport(
    pw: PlaywrightExtended,
    app: App,
    reviewer: UserProfile,
    team: {name: string},
    flaggedPostId: string,
    expectedMessage: string,
    status: string,
) {
    await openContentReview(app, team);
    const reportId = await reportPostId(pw, reviewer, flaggedPostId);
    await expectReport(reportCard(app, reportId), {status, message: expectedMessage});
    return reportId;
}

/** Opens a report's details in the RHS (from the card's View details button) and returns the RHS card. */
export async function openReportDetails(app: App, reportId: string): Promise<ReturnType<typeof reportCard>> {
    await app.center.postList.post({id: reportId}).spillageReport.footer.viewDetailsButton.click();
    const card = reportCard(app, reportId, 'rhs');
    await expect(card.field({name: 'status'})).toBeVisible();
    return card;
}

/** Verify flagged post details inside the RHS view */
export async function verifyRHSFlaggedPostDetails(
    app: App,
    reportId: string,
    postedByUsername: string,
    flaggedByUsername: string,
    postMessageFlagged: string,
    reasonToFlag: string,
    flagPostReviewStatus: string,
    postFlaggedInChannel: string,
) {
    const card = await openReportDetails(app, reportId);
    await expectReport(card, {status: flagPostReviewStatus, reason: reasonToFlag, message: postMessageFlagged});
    await expect(card.field({name: 'reporting_user_id'}).value.user).toContainText(flaggedByUsername);
    await expect(card.field({name: 'post_author'}).value.user).toContainText(postedByUsername);
    await expect(card.field({name: 'channel'}).value.channel).toContainText(postFlaggedInChannel);
}

/** As the reporter or author, checks the content-review bot's last message. */
export async function verifyReporterNotification(app: App, team: {name: string}, expectedMessage: string) {
    await openContentReview(app, team);
    await expect
        .poll(async () => {
            const keys = await app.center.postList.postList.keys();
            return app.center.postList.post({id: keys[keys.length - 1]}).message.container.text();
        })
        .toContain(expectedMessage);
}
