// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CircleSkeletonLoader, RectangleSkeletonLoader} from '@mattermost/components';
import {TopBoard} from '@mattermost/types/insights';
import React, {memo, useState, useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Avatars from 'components/widgets/users/avatars';

import WidgetEmptyState from '../widget_empty_state/widget_empty_state';
import widgetHoc, {WidgetHocProps} from '../widget_hoc/widget_hoc';
import {GlobalState} from 'types/store';

import './../../activity_and_insights.scss';

const TopBoards = (props: WidgetHocProps) => {
    const [loading, setLoading] = useState(true);
    const [topBoards, setTopBoards] = useState([] as TopBoard[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const boardsHandler = useSelector((state: GlobalState) => state.plugins.insightsHandlers.focalboard || state.plugins.insightsHandlers.boards);

    const getTopBoards = useCallback(async () => {
        setLoading(true);
        const data: any = await boardsHandler(props.timeFrame, 0, 4, currentTeamId, props.filterType);
        if (data && data.items) {
            setTopBoards(data.items);
        }
        setLoading(false);
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopBoards();
    }, [getTopBoards]);

    const skeletonLoader = useMemo(() => {
        const entries = [];
        for (let i = 0; i < 4; i++) {
            entries.push(
                <div
                    className='top-board-loading-container'
                    key={i}
                >
                    <CircleSkeletonLoader size={32}/>
                    <div className='loading-lines'>
                        <RectangleSkeletonLoader
                            height={12}
                            flex='none'
                        />
                        <RectangleSkeletonLoader
                            height={8}
                            flex='none'
                            margin='6px 0 0 0'
                        />
                    </div>
                </div>,
            );
        }
        return entries;
    }, []);

    const trackClickEvent = useCallback(() => {
        trackEvent('insights', 'open_board_from_top_boards_widget');
    }, []);

    return (
        <div className='top-board-container'>
            {
                loading &&
                skeletonLoader
            }
            {
                (topBoards && !loading) &&
                <div className='board-list'>
                    {
                        topBoards.map((board, i) => {
                            return (
                                <Link
                                    className='board-item'
                                    onClick={trackClickEvent}
                                    key={i}
                                    to={`/boards/team/${currentTeamId}/${board.boardID}`}
                                >
                                    <span className='board-icon'>{board.icon}</span>
                                    <div className='display-info'>
                                        <span className='display-name'>{board.title}</span>
                                        <span className='update-counts'>
                                            <FormattedMessage
                                                id='insights.topBoards.updates'
                                                defaultMessage='{updateCount} updates'
                                                values={{
                                                    updateCount: board.activityCount,
                                                }}
                                            />
                                        </span>
                                    </div>
                                    <Avatars

                                        // MM-49023: community bugfix to maintain backwards compatibility
                                        userIds={typeof board.activeUsers === 'string' ? board.activeUsers.split(',') : board.activeUsers}
                                        size='xs'
                                        disableProfileOverlay={true}
                                    />
                                </Link>
                            );
                        })
                    }
                </div>
            }
            {

                (topBoards.length === 0 && !loading) &&
                <WidgetEmptyState
                    icon={'product-boards'}
                />
            }
        </div>
    );
};

export default memo(widgetHoc(TopBoards));
