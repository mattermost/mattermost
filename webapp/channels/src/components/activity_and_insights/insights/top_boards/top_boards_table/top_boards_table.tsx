// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrame, TopBoard} from '@mattermost/types/insights';
import classNames from 'classnames';
import React, {memo, useState, useMemo, useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import Avatars from 'components/widgets/users/avatars';

import {GlobalState} from 'types/store';

import './../../../activity_and_insights.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;
}

const TopBoardsTable = (props: Props) => {
    const history = useHistory();

    const [loading, setLoading] = useState(true);
    const [topBoards, setTopBoards] = useState([] as TopBoard[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const boardsHandler = useSelector((state: GlobalState) => state.plugins.insightsHandlers.focalboard || state.plugins.insightsHandlers.boards);

    const getTopBoards = useCallback(async () => {
        setLoading(true);
        const data: any = await boardsHandler(props.timeFrame, 0, 10, currentTeamId, props.filterType);
        if (data && data.items) {
            setTopBoards(data.items);
        }
        setLoading(false);
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopBoards();
    }, [getTopBoards]);

    const goToBoard = useCallback((board: TopBoard) => {
        props.closeModal();
        trackEvent('insights', 'open_board_from_top_boards_modal');
        history.push(`/boards/team/${currentTeamId}/${board.boardID}`);
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
                        id='insights.topBoardsTable.board'
                        defaultMessage='Board'
                    />
                ),
                field: 'board',
                width: 0.7,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topBoardsTable.updates'
                        defaultMessage='Updates'
                    />
                ),
                field: 'updates',
                width: 0.08,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topBoardsTable.participants'
                        defaultMessage='Participants'
                    />
                ),
                field: 'participants',
                width: 0.15,
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return topBoards.map((board, i) => {
            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        board: (
                            <div className='board-item'>
                                <span className='board-icon'>{board.icon}</span>
                                <span className='board-title'>{board.title}</span>
                            </div>
                        ),
                        updates: (
                            <span className='board-updates'>{board.activityCount}</span>
                        ),
                        participants: (
                            <Avatars

                                // MM-49023: community bugfix to maintain backwards compatibility
                                userIds={typeof board.activeUsers === 'string' ? board.activeUsers.split(',') : board.activeUsers}
                                size='xs'
                                disableProfileOverlay={true}
                            />
                        ),
                    },
                    onClick: () => {
                        goToBoard(board);
                    },
                }
            );
        });
    }, [topBoards]);

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
            className={classNames('InsightsTable', 'TopBoardsTable')}
        />
    );
};

export default memo(TopBoardsTable);
