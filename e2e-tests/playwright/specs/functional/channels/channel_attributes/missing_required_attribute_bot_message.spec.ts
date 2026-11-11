// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {deleteAttributes, optionId, purgeAttributes, setChannelValue} from './helpers';
import {setUpTeamMissingRequiredValue} from './missing_required_helpers';

const SYSTEM_BOT_USERNAME = 'system-bot';
const MESSAGE_LEAD = 'Channel attribute values are missing in';

// The System bot is created on first use, so a user's DM with it only exists once
// something was sent. Opening it from the user's own session is harmless either way.
async function systemBotPosts(userClient: Client4, user: UserProfile) {
    const bot = await userClient.getUserByUsername(SYSTEM_BOT_USERNAME);
    const dm = await userClient.createDirectChannel([user.id, bot.id]);
    const list = await userClient.getPosts(dm.id);
    return list.order.map((id) => list.posts[id]).filter((post) => post.message.includes(MESSAGE_LEAD));
}

test.describe('Missing required channel attribute System bot message', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify creating a team sends its creator one System bot message that names Off-Topic,
     * Town Square and the attribute, and that its Off-Topic link opens the channel.
     */
    test('messages the team creator once about both default channels', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, team, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            const {channelsPage} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, `@${SYSTEM_BOT_USERNAME}`);

            // * One message arrives, naming both channels and the attribute
            const message = channelsPage.centerView.postViews.filter({hasText: MESSAGE_LEAD});
            await expect(message).toHaveCount(1, {timeout: 15000});
            await expect(message).toContainText('Off-Topic');
            await expect(message).toContainText('Town Square');
            await expect(message).toContainText(field.name);

            // # Follow the Off-Topic link
            await message.getByRole('link', {name: 'Off-Topic'}).click();

            // * The channel opens
            await expect(channelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${offTopic.name}$`));
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify promoting a member to channel admin of a channel that lacks the value sends that
     * member the System bot message for it, and that the member now sees the indicators there.
     */
    test('messages a member promoted to channel admin of a channel missing the value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, member, team, townSquare} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            // # The creator promotes the plain member in Town Square
            const {client: creatorClient} = await pw.makeClient(creator);
            await creatorClient.updateChannelMemberSchemeRoles(townSquare.id, member.id, true, true);

            // * The promoted member receives the message for Town Square
            const {channelsPage} = await pw.testBrowser.login(member);
            await channelsPage.goto(team.name, `@${SYSTEM_BOT_USERNAME}`);
            const message = channelsPage.centerView.postViews.filter({hasText: MESSAGE_LEAD});
            await expect(message).toHaveCount(1, {timeout: 15000});
            await expect(message).toContainText('Town Square');
            await expect(message).toContainText(field.name);

            // * As a channel admin now, the member sees the indicators in Town Square
            await channelsPage.goto(team.name, townSquare.name);
            await channelsPage.toBeVisible();
            await channelsPage.centerView.missingRequiredAttributes.toBeVisible(field.name);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify promoting a member on a channel that already has the value sends nothing, while
     * a later promotion on a channel that lacks it does, so the first silence is not just a slow send.
     */
    test('sends no message when the promoted channel already has the value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, member, townSquare, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );
            await setChannelValue(adminClient, offTopic.id, field, optionId(field, 'AURORA'));

            const {client: creatorClient} = await pw.makeClient(creator);
            const {client: memberClient} = await pw.makeClient(member);

            // # Promote the member where the value is already set
            await creatorClient.updateChannelMemberSchemeRoles(offTopic.id, member.id, true, true);

            // # Then promote them where it is missing, as the control
            await creatorClient.updateChannelMemberSchemeRoles(townSquare.id, member.id, true, true);

            // * Only the Town Square message exists
            await expect.poll(async () => (await systemBotPosts(memberClient, member)).length).toBe(1);
            const [post] = await systemBotPosts(memberClient, member);
            expect(post.message).toContain('Town Square');
            expect(post.message).not.toContain('Off-Topic');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
