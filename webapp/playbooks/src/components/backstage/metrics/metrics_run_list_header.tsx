// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {MetricsInfo} from 'src/components/backstage/metrics/metrics_run_list';

import {SortableColHeader} from 'src/components/sortable_col_header';
import {MetricType} from 'src/types/playbook';
import {FetchPlaybookRunsParams} from 'src/types/playbook_run';

interface Props {
    metricsInfo: MetricsInfo[];
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
}

const MetricsRunListHeader = ({metricsInfo, fetchParams, setFetchParams}: Props) => {
    const {formatMessage} = useIntl();

    function colHeaderClicked(index: number) {
        // convert index to the col name we use on the backend
        const colName = index === -1 ? 'name' : `metric${index}`;
        if (fetchParams.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const direction = fetchParams.direction === 'asc' ? 'desc' : 'asc';

            setFetchParams((oldParams) => ({...oldParams, direction}));
            return;
        }

        let direction = 'asc';
        if (index > -1) {
            // change to a new column; default to descending for time-based columns, ascending otherwise
            direction = (metricsInfo[index].type === MetricType.MetricDuration) ? 'desc' : 'asc';
        }

        setFetchParams((oldParams) => ({...oldParams, sort: colName, direction}));
    }

    return (
        <PlaybookRunListHeader>
            <div className='row'>
                <div className='col-sm-4'>
                    <SortableColHeader
                        name={formatMessage({defaultMessage: 'Run name'})}
                        direction={fetchParams.direction || 'desc'}
                        active={fetchParams.sort ? fetchParams.sort === 'name' : false}
                        onClick={() => colHeaderClicked(-1)}
                    />
                </div>
                {metricsInfo.map((m, idx) => (
                    <div
                        key={idx}
                        className='col-sm-2'
                    >
                        <SortableColHeader
                            name={m.title}
                            direction={fetchParams.direction || 'desc'}
                            active={fetchParams.sort === `metric${idx}`}

                            onClick={() => colHeaderClicked(idx)}
                        />
                    </div>
                ))}
            </div>
        </PlaybookRunListHeader>
    );
};

const PlaybookRunListHeader = styled.div`
    font-weight: 600;
    font-size: 11px;
    line-height: 36px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    padding: 0 1.6rem;
`;

export default MetricsRunListHeader;
