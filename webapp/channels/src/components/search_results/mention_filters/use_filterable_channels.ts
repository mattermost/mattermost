// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {
    getAllDirectChannels,
    getChannelsInAllTeams,
    getMyChannelMemberships,
} from 'mattermost-redux/selectors/entities/channels';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';

// useFilterableChannels lists the channels the mentions panel can be filtered down to: the ones the
// user belongs to, narrowed to a team when one is selected. Direct and group messages belong to no
// team, so they stay in the list whichever team is selected.
export default function useFilterableChannels(teamId: string | null): Channel[] {
    const channelsInAllTeams = useSelector(getChannelsInAllTeams);
    const directChannels = useSelector(getAllDirectChannels);
    const myMemberships = useSelector(getMyChannelMemberships);

    return useMemo(() => {
        const inTeams = teamId ? channelsInAllTeams.filter((channel) => channel.team_id === teamId) : channelsInAllTeams;

        return [...inTeams, ...directChannels].
            filter((channel) => Object.hasOwn(myMemberships, channel.id)).
            filter((channel) => channel.delete_at === 0);
    }, [channelsInAllTeams, directChannels, myMemberships, teamId]);
}

// useTeamNames maps team id to display name, for labelling a channel whose name alone is ambiguous
// across teams.
export function useTeamNames(): Record<string, string> {
    const teams = useSelector(getTeams);

    return useMemo(() => {
        const names: Record<string, string> = {};
        for (const team of Object.values(teams)) {
            names[team.id] = team.display_name;
        }
        return names;
    }, [teams]);
}
