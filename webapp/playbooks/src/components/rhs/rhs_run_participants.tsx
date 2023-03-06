// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeam} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/teams';

import {RHSContainer, RHSContent} from 'src/components/rhs/rhs_shared';

import {Participants} from 'src/components/backstage/playbook_runs/playbook_run/rhs_participants';
import {Role} from 'src/components/backstage/playbook_runs/shared';

import {PlaybookRun} from 'src/types/playbook_run';

interface Props {
    playbookRun: PlaybookRun
}

const RHSRunParticipants = (props: Props) => {
    const currentUserId = useSelector(getCurrentUserId);

    const team = useSelector(getCurrentTeam);

    if (!props.playbookRun) {
        return null;
    }

    const role = props.playbookRun?.participant_ids.includes(currentUserId) || props.playbookRun?.owner_user_id === currentUserId ? Role.Participant : Role.Viewer;

    return (
        <RHSContainer>
            <RHSContent>
                <Participants
                    playbookRun={props.playbookRun}
                    role={role}
                    teamName={team.name}
                />
            </RHSContent>
        </RHSContainer>
    );
};

export default RHSRunParticipants;
