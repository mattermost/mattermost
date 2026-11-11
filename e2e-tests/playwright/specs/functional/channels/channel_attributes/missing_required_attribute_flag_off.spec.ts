// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Missing required channel attribute indicators and messages with ChannelAttributesRequired off.
 *
 * Its own file because it needs the sub-flag off, unlike the other missing_required_attribute specs.
 * It calls ensureFeatureFlag with two combinations on purpose: a field can only be marked Required
 * while the sub-flag is on, so the test creates it first and then restarts the server with the
 * sub-flag off. The field stays Required across the restart; only enforcement is turned off.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {DISPLAY_LABEL_HEADER, attributeName, createAttribute, deleteAttributes, purgeAttributes} from './helpers';
import {MISSING_VALUE_OPTIONS} from './missing_required_helpers';

const SYSTEM_BOT_USERNAME = 'system-bot';
const MESSAGE_LEAD = 'Channel attribute values are missing in';

test.describe(
    'Missing required channel attribute indicators (ChannelAttributesRequired off)',
    {tag: ['@channel_attributes']},
    () => {
        /**
         * @objective Verify that with ChannelAttributesRequired off, a new team's creator sees no notice,
         * red Info button or header chip for a field still marked Required, and that neither creating the
         * team nor promoting a member sends a System bot message.
         */
        test('shows no indicators and sends no messages', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            await pw.skipIfNoLicense();

            let {adminClient} = await getAdminClient();
            if (!adminClient) {
                throw new Error('Admin client not available');
            }
            const suffix = pw.random.id();
            const created: PropertyField[] = [];

            try {
                await purgeAttributes(adminClient);
                const field = await createAttribute(adminClient, attributeName('flag_off', suffix), {
                    type: 'select',
                    options: MISSING_VALUE_OPTIONS,
                    required: true,
                    permissionValues: 'admin',
                    actions: [DISPLAY_LABEL_HEADER],
                });
                created.push(field);

                // # Turn required enforcement off. The restart replaces the server, so fetch a fresh client.
                await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: false});
                ({adminClient} = await getAdminClient());
                if (!adminClient) {
                    throw new Error('Admin client not available after restart');
                }

                // # A regular user creates a team, so its default channels lack the value
                const creator = await pw.createNewUserProfile(adminClient, {prefix: `creator-${suffix}`});
                const member = await pw.createNewUserProfile(adminClient, {prefix: `member-${suffix}`});
                const {client: creatorClient} = await pw.makeClient(creator);
                const team = await creatorClient.createTeam(await pw.random.team());
                await adminClient.addToTeam(team.id, member.id);
                const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

                // # The creator promotes the member in Town Square
                await creatorClient.updateChannelMemberSchemeRoles(townSquare.id, member.id, true, true);

                const {channelsPage, page} = await pw.testBrowser.login(creator);
                await channelsPage.goto(team.name, townSquare.name);
                await channelsPage.toBeVisible();
                await channelsPage.centerView.header.toHaveTitle('Town Square');

                // Let any attribute lookup the channel view makes settle before asserting absence
                await page.waitForLoadState('networkidle');

                // * No indicator is shown
                await channelsPage.centerView.missingRequiredAttributes.toBeHidden(field.name);

                // * Neither the team creation nor the promotion sent a System bot message. Both would have
                // been sent in the background seconds ago, while the page above loaded. The bot is created
                // on first use, so on a fresh server its absence already means nothing was sent.
                const bot = await adminClient.getUserByUsername(SYSTEM_BOT_USERNAME).catch(() => null);
                if (bot) {
                    for (const user of [creator, member]) {
                        const {client} = await pw.makeClient(user);
                        const dm = await client.createDirectChannel([user.id, bot.id]);
                        const list = await client.getPosts(dm.id);
                        const sent = list.order.filter((id) => list.posts[id].message.includes(MESSAGE_LEAD));
                        expect(sent).toHaveLength(0);
                    }
                }
            } finally {
                await deleteAttributes(adminClient, created);
            }
        });
    },
);
