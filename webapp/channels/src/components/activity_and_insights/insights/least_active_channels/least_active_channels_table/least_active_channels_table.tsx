// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import classNames from 'classnames';

import {trackEvent} from 'actions/telemetry_actions';

import {getLeastActiveChannelsForTeam, getMyLeastActiveChannels} from 'mattermost-redux/actions/insights';

import {LeastActiveChannel, TimeFrame} from '@mattermost/types/insights';

import {getCurrentRelativeTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Constants, {InsightsScopes} from 'utils/constants';

import Avatars from 'components/widgets/users/avatars';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import Timestamp from 'components/timestamp';

import ChannelActionsMenu from '../channel_actions_menu/channel_actions_menu';

import './../../../activity_and_insights.scss';
import './least_active_channels_table.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;

}

const LeastActiveChannelsTable = (props: Props) => {
    const dispatch = useDispatch();
    const history = useHistory();

    const [loading, setLoading] = useState(true);
    const [leastActiveChannels, setLeastActiveChannels] = useState([] as LeastActiveChannel[]);
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const currentTeamId = useSelector(getCurrentTeamId);

    const getInactiveChannels = useCallback(async () => {
        setLoading(true);
        if (props.filterType === InsightsScopes.TEAM) {
            const data: any = await dispatch(getLeastActiveChannelsForTeam(currentTeamId, 0, 10, props.timeFrame));
            if (data.data?.items) {
                setLeastActiveChannels(data.data.items);
            }
        } else {
            const data: any = await dispatch(getMyLeastActiveChannels(currentTeamId, 0, 10, props.timeFrame));
            if (data.data?.items) {
                setLeastActiveChannels(data.data.items);
            }
        }
        setLoading(false);
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getInactiveChannels();
    }, [getInactiveChannels]);

    const goToChannel = useCallback((channel: LeastActiveChannel) => {
        props.closeModal();
        trackEvent('insights', 'open_channel_from_least_active_channels_modal');
        history.push(`${currentTeamUrl}/channels/${channel.name}`);
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
                        id='insights.leastActiveChannels.channel'
                        defaultMessage='Channel'
                    />
                ),
                field: 'channel',
                width: 0.48,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.leastActiveChannels.lastActivityCell'
                        defaultMessage='Last activity'
                    />
                ),
                className: 'last-activity',
                field: 'lastActivity',
                width: 0.2,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.leastActiveChannels.members'
                        defaultMessage='Members'
                    />
                ),
                className: 'participants',
                field: 'participants',
                width: 0.15,
            },
            {
                name: (''),
                field: 'actions',
                width: 0.1,
                className: 'actions',
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return leastActiveChannels.map((channel, i) => {
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
                            <div className='channel-display-name'>
                                <span className='icon'>
                                    {iconToDisplay}
                                </span>
                                <span className='cell-text'>
                                    {channel.display_name}
                                </span>
                            </div>
                        ),
                        lastActivity: (
                            <span className='timestamp'>
                                {
                                    channel.last_activity_at === 0 ?
                                        <FormattedMessage
                                            id='insights.leastActiveChannels.lastActivityNone'
                                            defaultMessage='No activity'
                                        /> :
                                        <Timestamp
                                            value={channel.last_activity_at}
                                            units={[
                                                'now',
                                                'minute',
                                                'hour',
                                                'day',
                                                'week',
                                                'month',
                                            ]}
                                            useTime={false}
                                        />
                                }
                            </span>
                        ),
                        participants: (
                            <>
                                {channel.participants && channel.participants.length > 0 ? (
                                    <Avatars
                                        userIds={channel.participants}
                                        size='xs'
                                        disableProfileOverlay={true}
                                    />
                                ) : null}
                            </>

                        ),
                        actions: (
                            <ChannelActionsMenu
                                channel={channel}
                                actionCallback={getInactiveChannels}
                            />
                        ),
                    },
                    onClick: () => goToChannel(channel),
                }
            );
        });
    }, [leastActiveChannels]);

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
            className={classNames('InsightsTable', 'LeastActiveChannelsTable')}
        />
    );
};

export default memo(LeastActiveChannelsTable);
