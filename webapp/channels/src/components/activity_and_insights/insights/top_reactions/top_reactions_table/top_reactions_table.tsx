// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';

import {FormattedMessage} from 'react-intl';

import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {TimeFrame} from '@mattermost/types/insights';

import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';
import RenderEmoji from 'components/emoji/render_emoji';

import {InsightsScopes} from 'utils/constants';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getMyTopReactionsForCurrentTeam, getTopReactionsForCurrentTeam} from 'mattermost-redux/selectors/entities/insights';
import {getTopReactionsForTeam, getMyTopReactions} from 'mattermost-redux/actions/insights';

import './../../../activity_and_insights.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
}

const TopReactionsTable = (props: Props) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);

    const teamTopReactions = useSelector((state: GlobalState) => getTopReactionsForCurrentTeam(state, props.timeFrame, 10), shallowEqual);
    const myTopReactions = useSelector((state: GlobalState) => getMyTopReactionsForCurrentTeam(state, props.timeFrame, 10), shallowEqual);

    const currentTeamId = useSelector(getCurrentTeamId);

    const getTopTeamReactions = useCallback(async () => {
        if (props.filterType === InsightsScopes.TEAM) {
            setLoading(true);
            await dispatch(getTopReactionsForTeam(currentTeamId, 0, 10, props.timeFrame));
            setLoading(false);
        }
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopTeamReactions();
    }, [getTopTeamReactions]);

    const getMyTeamReactions = useCallback(async () => {
        if (props.filterType === InsightsScopes.MY) {
            setLoading(true);
            await dispatch(getMyTopReactions(currentTeamId, 0, 10, props.timeFrame));
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    useEffect(() => {
        getMyTeamReactions();
    }, [getMyTeamReactions]);

    useEffect(() => {
        const reactions = props.filterType === InsightsScopes.TEAM ? teamTopReactions : myTopReactions;
        dispatch(loadCustomEmojisIfNeeded(reactions.map((reaction) => reaction.emoji_name)));
    }, [props.filterType, teamTopReactions, myTopReactions]);

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
                        id='insights.topReactions.reaction'
                        defaultMessage='Reaction'
                    />
                ),
                field: 'reaction',
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topReactions.timesUsed'
                        defaultMessage='Times used'
                    />
                ),
                field: 'times_used',
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        const topReactions = props.filterType === InsightsScopes.TEAM ? teamTopReactions : myTopReactions;

        return topReactions.map((reaction, i) => {
            const barSize = (reaction.count / topReactions[0].count);
            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        reaction: (
                            <>
                                <RenderEmoji
                                    emojiName={reaction.emoji_name}
                                    size={24}
                                />
                                <span className='cell-text'>
                                    {reaction.emoji_name}
                                </span>
                            </>
                        ),
                        times_used: (
                            <div className='times-used-container'>
                                <span className='cell-text'>
                                    {reaction.count}
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
    }, [teamTopReactions, myTopReactions]);

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

export default memo(TopReactionsTable);
