// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';
import InfiniteScroll from 'react-infinite-scroll-component';

import {FetchPlaybookRunsParams, PlaybookRun} from 'src/types/playbook_run';
import Filters from 'src/components/backstage/runs_list/filters';
import {Metric, MetricType} from 'src/types/playbook';

import LoadingSpinner from 'src/components/assets/loading_spinner';

import MetricsRunListHeader from './metrics_run_list_header';
import MetricsRow from './metrics_row';

export interface MetricsInfo {
    type: MetricType;
    title: string;
    target: number;
}

interface Props {
    playbookMetrics: Metric[];
    playbookRuns: PlaybookRun[]
    totalCount: number
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
}

const MetricsRunList = ({
    playbookMetrics,
    playbookRuns,
    totalCount,
    fetchParams,
    setFetchParams,
}: Props) => {
    const metricsInfo = playbookMetrics.map((m) => ({type: m.type, title: m.title, target: m.target} as MetricsInfo));

    const isFiltering = (
        (fetchParams?.search_term?.length ?? 0) > 0 ||
        (fetchParams?.statuses?.length ?? 0) > 1 ||
        (fetchParams?.owner_user_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_or_follower_id?.length ?? 0) > 0
    );

    const nextPage = () => {
        setFetchParams((oldParam) => ({...oldParam, page: oldParam.page + 1}));
    };

    return (
        <PlaybookRunList id='playbookRunList'>
            <Filters
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
                fixedPlaybook={true}
                fixedFinished={true}
            />
            <MetricsRunListHeader
                metricsInfo={metricsInfo}
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
            />
            {playbookRuns.length === 0 && !isFiltering &&
                <div className='text-center pt-8'>
                    <FormattedMessage defaultMessage='There are no finished runs for this playbook.'/>
                </div>
            }
            {playbookRuns.length === 0 && isFiltering &&
                <div className='text-center pt-8'>
                    <FormattedMessage defaultMessage='There are no finished runs matching those filters.'/>
                </div>
            }
            <InfiniteScroll
                dataLength={playbookRuns.length}
                next={nextPage}
                hasMore={playbookRuns.length < totalCount}
                loader={<SpinnerContainer><StyledSpinner/></SpinnerContainer>}
                scrollableTarget={'playbooks-backstageRoot'}
            >
                {playbookRuns.map((playbookRun) => (
                    <MetricsRow
                        key={playbookRun.id}
                        metricsInfo={metricsInfo}
                        playbookRun={playbookRun}
                    />
                ))}
            </InfiniteScroll>
            <Footer>
                <Count>
                    <FormattedMessage
                        defaultMessage='{total, number} total'
                        values={{total: totalCount}}
                    />
                </Count>
            </Footer>
        </PlaybookRunList>
    );
};

const PlaybookRunList = styled.div`
    font-family: 'Open Sans', sans-serif;
    color: rgba(var(--center-channel-color-rgb), 0.90);
`;

const Footer = styled.div`
    margin: 10px 0 20px;
    font-size: 14px;
`;

const Count = styled.div`
    padding-top: 8px;
    width: 100%;
    text-align: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const SpinnerContainer = styled.div`
    width: 100%;
    height: 16px;
    text-align: center;
    margin-top: 10px;
    overflow: visible;
`;

const StyledSpinner = styled(LoadingSpinner)`
    width: auto;
    height: 100%;
`;

export default MetricsRunList;
