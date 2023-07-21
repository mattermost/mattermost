// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CircleSkeletonLoader, RectangleSkeletonLoader} from '@mattermost/components';
import {TopReaction} from '@mattermost/types/insights';
import {GlobalState} from '@mattermost/types/store';
import React, {memo, useEffect, useState, useCallback, useMemo} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';
import {getTopReactionsForTeam, getMyTopReactions} from 'mattermost-redux/actions/insights';
import {getTopReactionsForCurrentTeam, getMyTopReactionsForCurrentTeam} from 'mattermost-redux/selectors/entities/insights';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import WidgetEmptyState from '../widget_empty_state/widget_empty_state';
import widgetHoc, {WidgetHocProps} from '../widget_hoc/widget_hoc';
import {InsightsScopes} from 'utils/constants';

import TopReactionsBarChart from './top_reactions_bar_chart/top_reactions_bar_chart';

import './../../activity_and_insights.scss';

const TopReactions = (props: WidgetHocProps) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    const [topReactions, setTopReactions] = useState([] as TopReaction[]);

    const teamTopReactions = useSelector((state: GlobalState) => getTopReactionsForCurrentTeam(state, props.timeFrame, 5), shallowEqual);
    const myTopReactions = useSelector((state: GlobalState) => getMyTopReactionsForCurrentTeam(state, props.timeFrame, 5), shallowEqual);

    useEffect(() => {
        const reactions = props.filterType === InsightsScopes.TEAM ? teamTopReactions : myTopReactions;
        setTopReactions(reactions);
        dispatch(loadCustomEmojisIfNeeded(reactions.map((reaction) => reaction.emoji_name)));
    }, [props.filterType, teamTopReactions, myTopReactions]);

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

    const skeletonLoader = useMemo(() => {
        const barChartHeights = [140, 178, 140, 120, 140];
        const entries = [];

        for (let i = 0; i < 5; i++) {
            entries.push(
                <div
                    className='bar-chart-entry'
                    key={i}
                >
                    <RectangleSkeletonLoader
                        width={8}
                        height={barChartHeights[i]}
                        borderRadius={6}
                        margin='0 0 6px 0'
                    />
                    <CircleSkeletonLoader size={20}/>
                </div>,
            );
        }
        return entries;
    }, []);

    return (
        <div className='top-reaction-container'>
            {
                loading &&
                skeletonLoader
            }
            {
                (topReactions && !loading) &&
                <TopReactionsBarChart
                    reactions={topReactions}
                />
            }
            {
                (topReactions.length === 0 && !loading) &&
                <WidgetEmptyState
                    icon={'emoticon-outline'}
                />
            }
        </div>
    );
};

export default memo(widgetHoc(TopReactions));
