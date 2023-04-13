// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {
    HTMLAttributes,
    ReactNode,
    useEffect,
    useState,
} from 'react';

import StatsView from 'src/components/backstage/stats_view';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {PlaybookStats} from 'src/types/stats';
import {useRunsList} from 'src/hooks';

import {PlaybookRunStatus} from 'src/types/playbook_run';
import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';

import RunList from './runs_list/runs_list';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished],
};

interface Props {
    playbookID: string;
    stats: PlaybookStats;
}

type Attrs = HTMLAttributes<HTMLElement>;

const PlaybookUsage = ({
    playbookID,
    stats,
    ...attrs
}: Props & Attrs) => {
    usePlaybookViewTelemetry(PlaybookViewTarget.Usage, playbookID);
    const [filterPill, setFilterPill] = useState<ReactNode>(null);
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: playbookID, page: 0};
        });
    }, [playbookID, setFetchParams]);

    return (
        <OuterContainer {...attrs}>
            <InnerContainer>
                <StatsView
                    stats={stats}
                    fetchParams={fetchParams}
                    setFetchParams={setFetchParams}
                    setFilterPill={setFilterPill}
                />
                <RunListContainer>
                    <RunList
                        playbookRuns={playbookRuns}
                        totalCount={totalCount}
                        fetchParams={fetchParams}
                        setFetchParams={setFetchParams}
                        filterPill={filterPill}
                        fixedTeam={true}
                        fixedPlaybook={true}
                    />
                </RunListContainer>
            </InnerContainer>
        </OuterContainer>
    );
};

const OuterContainer = styled.div`
    height: 100%;
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;

    > div + div {
        margin-top: 16px;
    }
`;

const RunListContainer = styled.div`
    && {
        margin-top: 48px;
    }
`;

export default styled(PlaybookUsage)``;
