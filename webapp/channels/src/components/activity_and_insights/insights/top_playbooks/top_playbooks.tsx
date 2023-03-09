// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState, useCallback, useEffect, useMemo, ComponentProps} from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';

import {TopPlaybook} from '@mattermost/types/insights';

import {RectangleSkeletonLoader} from '@mattermost/components';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';

import {GlobalState} from 'types/store';

import Timestamp from 'components/timestamp';

import widgetHoc, {WidgetHocProps} from '../widget_hoc/widget_hoc';
import WidgetEmptyState from '../widget_empty_state/widget_empty_state';

import './../../activity_and_insights.scss';

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

const TopPlaybooks = (props: WidgetHocProps) => {
    const [loading, setLoading] = useState(false);
    const [topPlaybooks, setPlaybooks] = useState([] as TopPlaybook[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const playbooksHandler = useSelector((state: GlobalState) => state.plugins.insightsHandlers.playbooks);

    const getTopPlaybooks = useCallback(async () => {
        setLoading(true);
        const data: any = await playbooksHandler(props.timeFrame, 0, 3, currentTeamId, props.filterType);
        if (data.items) {
            setPlaybooks(data.items);
        }
        setLoading(false);
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopPlaybooks();
    }, [getTopPlaybooks]);

    const skeletonLoader = useMemo(() => {
        const entries = [];
        for (let i = 0; i < 3; i++) {
            entries.push(
                <div
                    className='top-playbooks-loading-container'
                    key={i}
                >
                    <RectangleSkeletonLoader
                        height={12}
                        margin='0 0 8px 0'
                    />
                    <RectangleSkeletonLoader
                        height={8}
                        margin='0 0 8px 0'
                        width='80%'
                    />
                </div>,
            );
        }
        return entries;
    }, []);

    const trackClickEvent = useCallback(() => {
        trackEvent('insights', 'open_playbook_from_top_playbooks_widget');
    }, []);

    return (
        <div className='top-playbooks-container'>
            {
                loading &&
                skeletonLoader
            }
            {
                (topPlaybooks && !loading) &&
                <div className='playbooks-list'>
                    {
                        topPlaybooks.map((playbook, key) => {
                            const barSize = (playbook.num_runs / topPlaybooks[0].num_runs) * 100;

                            return (
                                <Link
                                    className='playbook-item'
                                    onClick={trackClickEvent}
                                    to={`/playbooks/playbooks/${playbook.playbook_id}`}
                                    key={key}
                                >
                                    <div className='display-info'>
                                        <span className='display-name'>{playbook.title}</span>
                                        <span className='last-run-time'>
                                            <FormattedMessage
                                                id='insights.topPlaybooks.lastRun'
                                                defaultMessage='Last run: {relativeTime}'
                                                values={{
                                                    relativeTime: (
                                                        <Timestamp
                                                            value={playbook.last_run_at}
                                                            {...TIME_SPEC}
                                                        />
                                                    ),
                                                }}
                                            />
                                        </span>
                                    </div>
                                    <div className='display-info run-info'>
                                        <span
                                            className='horizontal-bar'
                                            style={{
                                                width: `${barSize}%`,
                                            }}
                                        />
                                        <span className='last-run-time'>
                                            <FormattedMessage
                                                id='insights.topPlaybooks.totalRuns'
                                                defaultMessage={'{total} runs'}
                                                values={{
                                                    total: playbook.num_runs,
                                                }}
                                            />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })
                    }

                </div>
            }
            {

                (topPlaybooks.length === 0 && !loading) &&
                <WidgetEmptyState
                    icon={'product-playbooks'}
                />
            }
        </div>
    );
};

export default memo(widgetHoc(TopPlaybooks));
