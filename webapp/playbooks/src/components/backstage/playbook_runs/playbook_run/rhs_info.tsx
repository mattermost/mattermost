// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {Channel} from '@mattermost/types/channels';

import RHSInfoOverview from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_overview';
import RHSInfoMetrics from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_metrics';
import RHSInfoActivity from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_activity';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {Metadata, PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';
interface Props {
    run: PlaybookRun;
    playbook?: PlaybookWithChecklist;
    runMetadata?: Metadata;
    role: Role;
    channel: Channel | undefined | null;
    followState: FollowState;
    onViewParticipants: () => void;
    onViewTimeline: () => void;
}

export interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

const RHSInfo = (props: Props) => {
    const isParticipant = props.role === Role.Participant;
    const isFinished = props.run.current_status === PlaybookRunStatus.Finished;
    const editable = isParticipant && !isFinished;

    return (
        <Container>
            <RHSInfoOverview
                role={props.role}
                run={props.run}
                runMetadata={props.runMetadata}
                onViewParticipants={props.onViewParticipants}
                editable={editable}
                channel={props.channel}
                followState={props.followState}
                playbook={props.playbook}
            />
            {props.run.retrospective_enabled ? (
                <RHSInfoMetrics
                    runID={props.run.id}
                    metricsData={props.run.metrics_data}
                    metricsConfig={props.playbook?.metrics}
                    editable={editable}
                />
            ) : null}
            <RHSInfoActivity
                run={props.run}
                role={props.role}
                onViewTimeline={props.onViewTimeline}
            />
        </Container>
    );
};

export default RHSInfo;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;
