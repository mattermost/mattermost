// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import classNames from 'classnames';

import {trackEvent} from 'actions/telemetry_actions';

import {getMyTopDMs} from 'mattermost-redux/actions/insights';

import {TimeFrame, TopDM} from '@mattermost/types/insights';
import {UserProfile} from '@mattermost/types/users';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {InsightsScopes} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import Avatar from 'components/widgets/users/avatar';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';

import './../../../activity_and_insights.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;
}

const TopDMsTable = (props: Props) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(false);
    const [topDMs, setTopDMs] = useState([] as TopDM[]);

    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const currentTeam = useSelector(getCurrentTeam);

    const getMyTopTeamDMs = useCallback(async () => {
        if (props.filterType === InsightsScopes.MY) {
            setLoading(true);
            const data: any = await dispatch(getMyTopDMs(currentTeam.id, 0, 10, props.timeFrame));
            if (data.data?.items) {
                setTopDMs(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    useEffect(() => {
        getMyTopTeamDMs();
    }, [getMyTopTeamDMs]);

    const closeModal = useCallback(() => {
        trackEvent('insights', 'open_dm_from_top_dms_modal');
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
                width: 0.05,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topDMs.user'
                        defaultMessage='User'
                    />
                ),
                field: 'user',
                width: 0.4,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topDMs.sentMessages'
                        defaultMessage='Sent'
                    />
                ),
                field: 'sent',
                className: 'message-count',
                width: 0.15,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topDMs.receivedMessages'
                        defaultMessage='Received'
                    />
                ),
                field: 'received',
                className: 'message-count',
                width: 0.15,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topDMs.totalMessages'
                        defaultMessage='Total messages'
                    />
                ),
                field: 'total',
                width: 0.25,
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return topDMs.map((dm, i) => {
            const barSize = (dm.post_count / topDMs[0].post_count);
            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        user: (
                            <Link
                                className='user-info'
                                to={`/${currentTeam.name}/messages/@${dm.second_participant.username}`}
                                onClick={closeModal}
                            >
                                <Avatar
                                    url={imageURLForUser(dm.second_participant.id, dm.second_participant.last_picture_update)}
                                    size={'sm'}
                                />
                                <span className='display-name'>{displayUsername(dm.second_participant as UserProfile, teammateNameDisplaySetting)}</span>
                            </Link>

                        ),
                        sent: (
                            <>
                                {dm.outgoing_message_count}
                            </>
                        ),
                        received: (
                            <>
                                {dm.post_count - dm.outgoing_message_count}
                            </>
                        ),
                        total: (
                            <div className='times-used-container'>
                                <span className='cell-text'>
                                    {dm.post_count}
                                </span>
                                <span
                                    className='horizontal-bar top-dms'
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
    }, [topDMs]);

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
            className={classNames('InsightsTable', 'TopDMsTable')}
        />
    );
};

export default memo(TopDMsTable);
