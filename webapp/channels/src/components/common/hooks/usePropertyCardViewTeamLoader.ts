// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';

import type {Team} from '@mattermost/types/teams';

import {useTeam} from 'components/common/hooks/use_team';

export function usePropertyCardViewTeamLoader(teamId?: string, getTeam?: (teamId: string) => Promise<Team>) {
    const loadedTeam = useRef(false);
    const [team, setTeam] = useState<Team>();

    const teamFromStore = useTeam(teamId || '');

    useEffect(() => {
        if (team && team.id !== teamId) {
            setTeam(undefined);
            loadedTeam.current = false;
        }
    }, [team, teamId]);

    useEffect(() => {
        const useTeamFromStore = Boolean(!getTeam && teamFromStore);
        if (useTeamFromStore) {
            setTeam(teamFromStore);
            loadedTeam.current = true;
            return;
        }

        const loadTeam = async () => {
            const canLoadTeam = !loadedTeam.current && teamId && getTeam && !team;
            if (!canLoadTeam) {
                return;
            }

            try {
                const fetchedTeam = await getTeam(teamId);
                if (fetchedTeam) {
                    setTeam(fetchedTeam);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log('Error occurred while fetching team for post preview property renderer', error);
            } finally {
                loadedTeam.current = true;
            }
        };

        loadTeam();
    }, [teamId, getTeam, team, teamFromStore]);

    return team;
}
