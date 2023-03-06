// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useEffect} from 'react';
import styled from 'styled-components';

import {PlaybookStats} from 'src/types/stats';
import {useAllowPlaybookAndRunMetrics, useRunsList} from 'src/hooks';

import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {PlaybookRunStatus} from 'src/types/playbook_run';

import {Metric} from 'src/types/playbook';
import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';

import NoMetricsPlaceholder from './no_metrics_placeholder';
import MetricsRunList from './metrics_run_list';
import MetricsStatsView from './metrics_stats_view';
import UpgradeKeyMetricsPlaceholder from './upgrade_key_metrics_placeholder';

const defaultPlaybookFetchParams = {
    page: 0,
    per_page: BACKSTAGE_LIST_PER_PAGE,
    sort: 'last_status_update_at',
    direction: 'desc',
    statuses: [PlaybookRunStatus.Finished],
};

interface Props {
    playbookID: string
    playbookMetrics: Metric[]
    stats: PlaybookStats;
}

type Attrs = HTMLAttributes<HTMLElement>;

const PlaybookKeyMetrics = ({
    playbookID,
    playbookMetrics,
    stats,
    ...attrs
}: Props & Attrs) => {
    usePlaybookViewTelemetry(PlaybookViewTarget.Reports, playbookID);
    const allowStatsView = useAllowPlaybookAndRunMetrics();
    const [playbookRuns, totalCount, fetchParams, setFetchParams] = useRunsList(defaultPlaybookFetchParams);

    useEffect(() => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: playbookID};
        });
    }, [playbookID, setFetchParams]);

    let content;

    if (!allowStatsView) {
        content = (
            <PlaceholderRow>
                <UpgradeKeyMetricsPlaceholder/>
            </PlaceholderRow>
        );
    } else if (playbookMetrics.length === 0) {
        content = <NoMetricsPlaceholder/>;
    } else {
        content = (
            <>
                <MetricsStatsView
                    playbookMetrics={playbookMetrics}
                    stats={stats}
                />
                <RunListContainer>
                    <MetricsRunList
                        playbookMetrics={playbookMetrics}
                        playbookRuns={playbookRuns}
                        totalCount={totalCount}
                        fetchParams={fetchParams}
                        setFetchParams={setFetchParams}
                    />
                </RunListContainer>
            </>
        );
    }

    return (
        <OuterContainer {...attrs}>
            <InnerContainer>
                {content}
            </InnerContainer>
        </OuterContainer>
    );
};

const PlaceholderRow = styled.div`
    height: 260px;
    margin: 32px 0;
`;

const OuterContainer = styled.div`
    height: 100%;
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0 20px 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;
`;

const RunListContainer = styled.div`
    && {
        margin-top: 36px;
    }
`;

export default styled(PlaybookKeyMetrics)``;
