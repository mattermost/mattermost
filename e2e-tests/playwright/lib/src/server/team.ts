// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {Team, TeamType} from '@mattermost/types/teams';

import {getRandomId} from '@/util';

export async function createNewTeam(
    client: Client4,
    options: {name?: string; displayName?: string; type?: TeamType; unique?: boolean} = {
        name: 'team',
        displayName: 'Team',
        type: 'O' as TeamType,
        unique: true,
    },
) {
    const randomTeam = await createRandomTeam(options.name, options.displayName, options.type, options.unique);
    const newTeam = await client.createTeam(randomTeam);

    return newTeam;
}

export async function createRandomTeam(
    name = 'team',
    displayName = 'Team',
    type: TeamType = 'O',
    unique = true,
): Promise<Team> {
    const randomSuffix = await getRandomId();

    const team = {
        name: unique ? `${name}-${randomSuffix}` : name,
        display_name: unique ? `${displayName} ${randomSuffix}` : displayName,
        type,
    };

    return team as Team;
}
