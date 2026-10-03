// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {Playbook} from 'src/types/playbook';

import PlaybookListSvg from 'src/components/assets/illustrations/playbook_list_svg';
import {openPlaybookRunModal} from 'src/actions';
import {navigateToPluginUrl} from 'src/browser_routing';
import {useCanCreatePlaybooksInTeam, usePlaybooksCrud, usePlaybooksRouting} from 'src/hooks';
import {PrimaryButton} from 'src/components/assets/buttons';

import {clientHasPlaybooks} from 'src/client';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

const NoContentContainer = styled.div`
    display: flex;
    flex-direction: row;
    margin: 0 10vw;
    height: 100%;
    align-items: center;
    justify-content: center;
`;

const NoContentTextContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0 40px 0 20px;
`;

const NoContentTitle = styled.h2`
    font-family: "Open Sans";
    font-style: normal;
    letter-spacing: -0.02em;
    font-size: 28px;
    color: var(--center-channel-color);
    text-align: left;
`;

const NoContentDescription = styled.h5`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-family: "Open Sans";
    font-size: 16px;
    font-style: normal;
    font-weight: normal;
    line-height: 24px;
    text-align: left;
`;

const NoContentPlaybookRunSvgContainer = styled.div`
    @media (width <= 1000px) {
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
                onRunCreated: (runId: string) => {
                    navigateToPluginUrl(`/runs/${runId}?from=run_modal`);
                    refreshLHS();
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
                <PlaybookListSvg/>
            </NoContentPlaybookRunSvgContainer>
        </NoContentContainer>
    );
};

export default NoContentPage;
