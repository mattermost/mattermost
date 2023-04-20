// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import styled from 'styled-components';

import {Redirect} from 'react-router-dom';

import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {clientHasPlaybooks, fetchPlaybookRuns} from 'src/client';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';

import {useRunsList} from 'src/hooks';

import {pluginUrl} from 'src/browser_routing';

import Header from 'src/components/widgets/header';

import {PlaybookRunType} from 'src/graphql/generated/graphql';

import RunList from './runs_list/runs_list';
import NoContentPage from './runs_page_no_content';

const statusOptions: StatusOption[] = [
    {value: '', label: 'All'},
    {value: 'InProgress', label: 'In Progress'},
    {value: 'Finished', label: 'Finished'},
];

interface StatusOption {
    value: string;
    label: string;
}

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    participant_or_follower_id: '',
    statuses: statusOptions
        .filter((opt) => opt.value !== 'Finished' && opt.value !== '')
        .map((opt) => opt.value),
    types: [PlaybookRunType.Playbook],
};

const RunListContainer = styled.div`
    flex: 1 1 auto;
`;

const RunsPage = () => {
    const {formatMessage} = useIntl();
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);
    const [showNoPlaybookRuns, setShowNoPlaybookRuns] = useState<boolean | null>(null);
    const [noPlaybooks, setNoPlaybooks] = useState<boolean | null>(null);
    const currentTeamId = useSelector(getCurrentTeamId);

    // When the component is first mounted, determine if there are any
    // playbook runs at all, ignoring filters. Decide once if we should show the "no playbook runs"
    // landing page.
    useEffect(() => {
        async function checkForPlaybookRuns() {
            const playbookRunsReturn = await fetchPlaybookRuns({page: 0, per_page: 1, team_id: currentTeamId});
            const hasPlaybooks = await clientHasPlaybooks(currentTeamId);
            setShowNoPlaybookRuns(playbookRunsReturn.items.length === 0);
            setNoPlaybooks(!hasPlaybooks);
        }

        checkForPlaybookRuns();
    }, [currentTeamId]);

    if (showNoPlaybookRuns == null || noPlaybooks == null) {
        return null;
    }

    if (showNoPlaybookRuns) {
        if (noPlaybooks) {
            return <Redirect to={pluginUrl('/start')}/>;
        }
        return <NoContentPage/>;
    }

    return (
        <RunListContainer>
            <Header
                data-testid='titlePlaybookRun'
                level={2}
                heading={formatMessage({defaultMessage: 'Runs'})}
                subtitle={formatMessage({defaultMessage: 'All the runs that you can access will show here'})}
                css={`
                    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
                `}
            />
            <RunList
                playbookRuns={playbookRuns}
                totalCount={totalCount}
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
                filterPill={null}
            />
        </RunListContainer>
    );
};

export default RunsPage;
