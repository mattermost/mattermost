// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import LocalStorageStore from 'stores/local_storage_store';
import {useGlobalState} from 'stores/hooks';

import {InsightsScopes, PreviousViewedTypes, suitePluginIds} from 'utils/constants';
import {useProducts} from 'utils/products';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import {CardSizes, InsightsWidgetTypes, TimeFrame, TimeFrames} from '@mattermost/types/insights';

import InsightsHeader from './insights_header/insights_header';
import TopChannels from './top_channels/top_channels';
import TopReactions from './top_reactions/top_reactions';
import TopThreads from './top_threads/top_threads';
import TopBoards from './top_boards/top_boards';
import LeastActiveChannels from './least_active_channels/least_active_channels';
import TopPlaybooks from './top_playbooks/top_playbooks';
import TopDMsAndNewMembers from './top_dms_and_new_members/top_dms_and_new_members';

import {useGetFilterType} from './hooks';

import './../activity_and_insights.scss';

type SelectOption = {
    value: string;
    label: string;
}

const Insights = () => {
    const dispatch = useDispatch();
    const products = useProducts();

    let focalboardEnabled = false;
    let playbooksEnabled = false;
    if (products) {
        products.forEach((product) => {
            if (product.pluginId === suitePluginIds.playbooks) {
                playbooksEnabled = true;
            }
        });
    }

    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);

    const [filterType, setFilterType] = useGetFilterType();
    const [timeFrame, setTimeFrame] = useGlobalState(TimeFrames.INSIGHTS_7_DAYS as string, 'insightsTimeFrame');

    const setFilterTypeTeam = useCallback(() => {
        trackEvent('insights', 'change_scope_to_team_insights');
        setFilterType(InsightsScopes.TEAM);
    }, []);

    const setFilterTypeMy = useCallback(() => {
        trackEvent('insights', 'change_scope_to_my_insights');
        setFilterType(InsightsScopes.MY);
    }, []);

    const setTimeFrameValue = useCallback((value: SelectOption) => {
        setTimeFrame(value.value);
    }, []);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Insights));
        dispatch(suppressRHS);
        const penultimateType = LocalStorageStore.getPreviousViewedType(currentUserId, currentTeamId);

        if (penultimateType !== PreviousViewedTypes.INSIGHTS) {
            LocalStorageStore.setPenultimateViewedType(currentUserId, currentTeamId, penultimateType);
            LocalStorageStore.setPreviousViewedType(currentUserId, currentTeamId, PreviousViewedTypes.INSIGHTS);
        }

        return () => {
            dispatch(unsuppressRHS);
        };
    }, []);

    return (
        <>
            <InsightsHeader
                filterType={filterType}
                setFilterTypeTeam={setFilterTypeTeam}
                setFilterTypeMy={setFilterTypeMy}
                timeFrame={timeFrame}
                setTimeFrame={setTimeFrameValue}
            />
            <div className='insights-body'>
                <TopChannels
                    size={CardSizes.large}
                    filterType={filterType}
                    widgetType={InsightsWidgetTypes.TOP_CHANNELS}
                    class={'top-channels-card'}
                    timeFrame={timeFrame as TimeFrame}
                />
                <div className='card-row'>
                    <TopThreads
                        size={focalboardEnabled ? CardSizes.small : CardSizes.medium}
                        filterType={filterType}
                        widgetType={InsightsWidgetTypes.TOP_THREADS}
                        class={'top-threads-card'}
                        timeFrame={timeFrame as TimeFrame}
                    />
                    {
                        focalboardEnabled &&
                        <TopBoards
                            size={CardSizes.small}
                            filterType={filterType}
                            widgetType={InsightsWidgetTypes.TOP_BOARDS}
                            class={'top-boards-card'}
                            timeFrame={timeFrame as TimeFrame}
                        />
                    }
                    <TopReactions
                        size={focalboardEnabled ? CardSizes.small : CardSizes.medium}
                        filterType={filterType}
                        widgetType={InsightsWidgetTypes.TOP_REACTIONS}
                        class={'top-reactions-card'}
                        timeFrame={timeFrame as TimeFrame}
                    />
                </div>
                <TopDMsAndNewMembers
                    size={CardSizes.large}
                    filterType={filterType}
                    widgetType={filterType === InsightsScopes.MY ? InsightsWidgetTypes.TOP_DMS : InsightsWidgetTypes.NEW_TEAM_MEMBERS}
                    class={'top-dms-card'}
                    timeFrame={timeFrame as TimeFrame}
                />
                <div className='card-row'>
                    <LeastActiveChannels
                        size={CardSizes.medium}
                        filterType={filterType}
                        widgetType={InsightsWidgetTypes.LEAST_ACTIVE_CHANNELS}
                        class={'least-active-channels-card'}
                        timeFrame={timeFrame as TimeFrame}
                    />
                    {
                        playbooksEnabled &&
                        <TopPlaybooks
                            size={CardSizes.medium}
                            filterType={filterType}
                            widgetType={InsightsWidgetTypes.TOP_PLAYBOOKS}
                            class={'top-playbooks-card'}
                            timeFrame={timeFrame as TimeFrame}
                        />
                    }
                </div>

            </div>
        </>
    );
};

export default memo(Insights);
