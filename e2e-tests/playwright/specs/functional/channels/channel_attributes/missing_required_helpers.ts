// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {DISPLAY_LABEL_HEADER, attributeName, createAttribute} from './helpers';

export const MISSING_VALUE_OPTIONS = ['AURORA', 'ZEPHYR'];

export type MissingRequiredState = {
    field: PropertyField;
    creator: UserProfile & {password: string};
    member: UserProfile & {password: string};
    team: Team;
    townSquare: Channel;
    offTopic: Channel;
};

/**
 * A required, admin-level select shown in the channel header, then a regular user
 * who creates a team afterwards. Town Square and Off-Topic are created by a
 * machine path with no value, and the creator is their channel admin. A second
 * user joins the team as a plain member.
 *
 * The attribute is created with its backfill first, so the only channels that
 * lack a value are the ones the new team brings.
 */
export async function setUpTeamMissingRequiredValue(
    pw: PlaywrightExtended,
    adminClient: Client4,
    suffix: string,
    created: PropertyField[],
): Promise<MissingRequiredState> {
    const field = await createAttribute(adminClient, attributeName('missing', suffix), {
        type: 'select',
        options: MISSING_VALUE_OPTIONS,
        required: true,
        permissionValues: 'admin',
        actions: [DISPLAY_LABEL_HEADER],
    });
    created.push(field);

    const creator = await pw.createNewUserProfile(adminClient, {prefix: `creator-${suffix}`});
    const member = await pw.createNewUserProfile(adminClient, {prefix: `member-${suffix}`});

    const {client: creatorClient} = await pw.makeClient(creator);
    const team = await creatorClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, member.id);

    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');

    return {field, creator, member, team, townSquare, offTopic};
}
