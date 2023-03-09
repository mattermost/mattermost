// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';

// Use when sorting multiple teams by their `display_name` field
function compareTeamsByDisplayName(locale: string, a: Team, b: Team) {
    if (a.display_name !== null) {
        if (a.display_name !== b.display_name) {
            return a.display_name.localeCompare(b.display_name, locale, {numeric: true});
        }
    }

    return a.name.localeCompare(b.name, locale, {numeric: true});
}

// Use to filter out teams that are deleted and without display_name, then sort by their `display_name` field
export function filterAndSortTeamsByDisplayName<T extends Team>(teams: T[], locale: string, teamsOrder = '') {
    if (!teams) {
        return [];
    }

    const teamsOrderList = teamsOrder.split(',');

    const customSortedTeams = teams.filter((team) => {
        if (team !== null) {
            return teamsOrderList.includes(team.id);
        }
        return false;
    }).sort((a, b) => {
        return teamsOrderList.indexOf(a.id) - teamsOrderList.indexOf(b.id);
    });

    const otherTeams = teams.filter((team) => {
        if (team !== null) {
            return !teamsOrderList.includes(team.id);
        }
        return false;
    }).sort((a, b) => {
        return compareTeamsByDisplayName(locale, a, b);
    });

    return [...customSortedTeams, ...otherTeams].filter((team) => {
        // TODO: Fix. Asserting type right now because do not want to affect in productino behavior.
        return team && (!team.delete_at as unknown as number) > 0 && team.display_name != null;
    });
}

export function makeNewTeam(displayName: string, name: string): Team {
    return {
        id: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        display_name: displayName,
        name,
        description: '',
        email: '',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: false,
        scheme_id: '',
        group_constrained: false,
    };
}
