// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrame, TopChannel} from '@mattermost/types/insights';
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {getMyTopChannels, getTopChannelsForTeam} from 'mattermost-redux/actions/insights';
import {getCurrentRelativeTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';

import Constants, {InsightsScopes} from 'utils/constants';

import './../../../activity_and_insights.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;
}

const TopChannelsTable = (props: Props) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    const [topChannels, setTopChannels] = useState([] as TopChannel[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const getTopTeamChannels = useCallback(async () => {
        if (props.filterType === InsightsScopes.TEAM) {
            setLoading(true);
            const data: any = await dispatch(getTopChannelsForTeam(currentTeamId, 0, 10, props.timeFrame));
            if (data.data && data.data.items) {
                setTopChannels(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopTeamChannels();
    }, [getTopTeamChannels]);

    const getMyTeamChannels = useCallback(async () => {
        if (props.filterType === InsightsScopes.MY) {
            setLoading(true);
            const data: any = await dispatch(getMyTopChannels(currentTeamId, 0, 10, props.timeFrame));
            if (data.data && data.data.items) {
                setTopChannels(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    useEffect(() => {
        getMyTeamChannels();
    }, [getMyTeamChannels]);

    const closeModal = useCallback(() => {
        trackEvent('insights', 'open_channel_from_top_channels_modal');
        props.closeModal();
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
                width: 0.2,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topChannels.channel'
                        defaultMessage='Channel'
                    />
                ),
                field: 'channel',
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topChannels.totalMessages'
                        defaultMessage='Total messages'
                    />
                ),
                field: 'message_count',
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return topChannels.map((channel, i) => {
            const barSize = (channel.message_count / topChannels[0].message_count);

            let iconToDisplay = <i className='icon icon-globe'/>;

            if (channel.type === Constants.PRIVATE_CHANNEL) {
                iconToDisplay = <i className='icon icon-lock-outline'/>;
            }
            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        channel: (
                            <Link
                                className='channel-display-name'
                                to={`${currentTeamUrl}/channels/${channel.name}`}
                                onClick={closeModal}
                            >
                                <span className='icon'>
                                    {iconToDisplay}
                                </span>
                                <span className='cell-text'>
                                    {channel.display_name}
                                </span>
                            </Link>
                        ),
                        message_count: (
                            <div className='times-used-container'>
                                <span className='cell-text'>
                                    {channel.message_count}
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
                }
            );
        });
    }, [topChannels]);

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
            className={'InsightsTable'}
        />
    );
};

export default memo(TopChannelsTable);
