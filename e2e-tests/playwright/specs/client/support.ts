// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {ServerChannel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

import {getFileFromAsset, getBlobFromAsset, PlaywrightExtended} from '@mattermost/playwright-lib';

export const filename = 'mattermost-icon_128x128.png';
export const file = getFileFromAsset(filename);
export const blob = getBlobFromAsset(filename);

export type UploadFileTestContext = {
    userClient: Client4;
    user: UserProfile;
    team: Team;
    townSquareChannel: ServerChannel;
};

export async function initUploadFileTestContext(pw: PlaywrightExtended): Promise<UploadFileTestContext> {
    const {userClient, user, team} = await pw.initSetup();
    const townSquareChannel = await userClient.getChannelByName(team.id, 'town-square');
    return {userClient, user, team, townSquareChannel};
}
