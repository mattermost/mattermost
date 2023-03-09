// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {Playbook} from 'src/types/playbook';

import NoContentPlaybookRunSvg from 'src/components/assets/no_content_playbook_runs_svg';
import {openPlaybookRunModal} from 'src/actions';
import {navigateToPluginUrl} from 'src/browser_routing';
import {useCanCreatePlaybooksInTeam, usePlaybooksCrud, usePlaybooksRouting} from 'src/hooks';
import {PrimaryButton} from 'src/components/assets/buttons';

import {clientHasPlaybooks, telemetryEvent} from 'src/client';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {PlaybookRunEventTarget} from 'src/types/telemetry';

const NoContentContainer = styled.div`
    display: flex;
    flex-direction: row;
    margin: 0 10vw;
    height: 100%;
    align-items: center;
`;

const NoContentTextContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0 20px;
`;

const NoContentTitle = styled.h2`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: left;
`;

const NoContentDescription = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: left;
`;

const NoContentPlaybookRunSvgContainer = styled.div`
    @media (max-width: 1000px) {
        display: none;
    }
`;

const NoContentPage = () => {
    const dispatch = useDispatch();
    const teamId = useSelector<GlobalState, string>(getCurrentTeamId);
    const [playbookExist, setPlaybookExist] = useState(false);
    const {setSelectedPlaybook} = usePlaybooksCrud({team_id: '', per_page: BACKSTAGE_LIST_PER_PAGE});
    const {create} = usePlaybooksRouting<Playbook>({onGo: setSelectedPlaybook});
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(teamId);
    const refreshLHS = useLHSRefresh();

    // When the component is first mounted, determine if there are any
    // playbooks at all.If yes show Run playbook else create playbook
    useEffect(() => {
        async function checkForPlaybook() {
            const returnedPlaybookExist = await clientHasPlaybooks(teamId);
            setPlaybookExist(returnedPlaybookExist);
        }
        checkForPlaybook();
    }, [teamId]);

    const handleClick = () => {
        if (playbookExist) {
            dispatch(openPlaybookRunModal({
                teamId,
                onRunCreated: (runId: string, channelId: string, statsData: object) => {
                    navigateToPluginUrl(`/runs/${runId}?from=run_modal`);
                    refreshLHS();
                    telemetryEvent(PlaybookRunEventTarget.Create, {...statsData, place: 'backstage_runs_no_content'});
                },
            }));
        } else {
            create({teamId});
        }
    };

    return (
        <NoContentContainer>
            <NoContentTextContainer>
                <NoContentTitle><FormattedMessage defaultMessage='What are playbook runs?'/></NoContentTitle>
                <NoContentDescription><FormattedMessage defaultMessage='Running a playbook orchestrates workflows for your team and tools.'/></NoContentDescription>
                {(canCreatePlaybooks || playbookExist) &&
                <PrimaryButton
                    className='mt-6'
                    onClick={handleClick}
                >
                    <i className='icon-plus mr-2'/>
                    {playbookExist ? <FormattedMessage defaultMessage='Run playbook'/> : <FormattedMessage defaultMessage='Create playbook'/>}
                </PrimaryButton>
                }
            </NoContentTextContainer>
            <NoContentPlaybookRunSvgContainer>
                <NoContentPlaybookRunSvg/>
            </NoContentPlaybookRunSvgContainer>
        </NoContentContainer>
    );
};

export default NoContentPage;
