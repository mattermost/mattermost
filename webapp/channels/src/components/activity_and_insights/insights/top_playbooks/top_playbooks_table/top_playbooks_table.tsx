// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState, useMemo, useEffect, useCallback, ComponentProps} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {useHistory} from 'react-router-dom';

import classNames from 'classnames';

import {trackEvent} from 'actions/telemetry_actions';

import {GlobalState} from 'types/store';

import {TimeFrame, TopPlaybook} from '@mattermost/types/insights';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import Timestamp from 'components/timestamp';

import './../../../activity_and_insights.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;
}

const TIME_SPEC: Partial<ComponentProps<typeof Timestamp>> = {
    units: [
        'now',
        'minute',
        ['hour', -48],
        ['day', -30],
        'month',
        'year',
    ],
    useTime: false,
    day: 'numeric',
    style: 'long',
};

const TopPlaybooksTable = (props: Props) => {
    const history = useHistory();

    const [loading, setLoading] = useState(false);
    const [topPlaybooks, setTopPlaybooks] = useState([] as TopPlaybook[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const playbooksHandler = useSelector((state: GlobalState) => state.plugins.insightsHandlers.playbooks);

    const getTopPlaybooks = useCallback(async () => {
        setLoading(true);
        const data: any = await playbooksHandler(props.timeFrame, 0, 10, currentTeamId, props.filterType);
        if (data.items) {
            setTopPlaybooks(data.items);
        }
        setLoading(false);
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopPlaybooks();
    }, [getTopPlaybooks]);

    const goToPlaybook = useCallback((playbook: TopPlaybook) => {
        props.closeModal();
        trackEvent('insights', 'open_playbook_from_top_playbooks_modal');
        history.push(`/playbooks/playbooks/${playbook.playbook_id}`);
    }, [props.closeModal]);

    const getColumns = useMemo((): Column[] => {
        const columns: Column[] = [
            {
                name: (
                    <FormattedMessage
                        id='insights.topReactions.rank'
                        defaultMessage='Rank'
                    />
                ),
                field: 'rank',
                className: 'rankCell',
                width: 0.07,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topPlaybooksTable.playbook'
                        defaultMessage='Playbook'
                    />
                ),
                field: 'playbook',
                width: 0.4,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topPlaybooksTable.updates'
                        defaultMessage='Last run'
                    />
                ),
                field: 'lastRun',
                width: 0.23,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topPlaybooksTable.participants'
                        defaultMessage='Total runs'
                    />
                ),
                field: 'totalRuns',
                width: 0.3,
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return topPlaybooks.map((playbook, i) => {
            const barSize = (playbook.num_runs / topPlaybooks[0].num_runs);

            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        playbook: (
                            <div className='channel-display-name'>
                                <span className='cell-text'>
                                    {playbook.title}
                                </span>
                            </div>
                        ),
                        lastRun: (

                            <>
                                <Timestamp
                                    value={playbook.last_run_at}
                                    {...TIME_SPEC}
                                />
                            </>
                        ),
                        totalRuns: (
                            <div className='times-used-container'>
                                <span className='cell-text'>
                                    {playbook.num_runs}
                                </span>
                                <span
                                    className='horizontal-bar'
                                    style={{
                                        flex: `${barSize} 0`,
                                    }}
                                />
                            </div>
                        ),
                    },
                    onClick: () => {
                        goToPlaybook(playbook);
                    },
                }
            );
        });
    }, [topPlaybooks]);

    return (
        <DataGrid
            columns={getColumns}
            rows={getRows}
            loading={loading}
            page={0}
            nextPage={() => {}}
            previousPage={() => {}}
            startCount={1}
            endCount={10}
            total={0}
            className={classNames('InsightsTable', 'TopPlaybooksTable')}
        />
    );
};

export default memo(TopPlaybooksTable);
