// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useState, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {NewMember, TopDM} from '@mattermost/types/insights';

import {CircleSkeletonLoader, RectangleSkeletonLoader} from '@mattermost/components';

import {getMyTopDMs, getNewTeamMembers} from 'mattermost-redux/actions/insights';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';
import {trackEvent} from 'actions/telemetry_actions';

import {InsightsScopes, ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import widgetHoc, {WidgetHocProps} from '../widget_hoc/widget_hoc';
import WidgetEmptyState from '../widget_empty_state/widget_empty_state';
import InsightsModal from '../insights_modal/insights_modal';

import TopDMsItem from './top_dms_item/top_dms_item';
import NewMembersItem from './new_members_item/new_members_item';
import NewMembersTotal from './new_members_total/new_members_total';

import './../../activity_and_insights.scss';

const TopDMsAndNewMembers = (props: WidgetHocProps) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(false);
    const [topDMs, setTopDMs] = useState([] as TopDM[]);
    const [newMembers, setNewMembers] = useState([] as NewMember[]);
    const [totalNewMembers, setTotalNewMembers] = useState(0);

    const currentTeam = useSelector(getCurrentTeam);

    const getMyTopTeamDMs = useCallback(async () => {
        if (props.filterType === InsightsScopes.MY) {
            setLoading(true);
            const data: any = await dispatch(getMyTopDMs(currentTeam.id, 0, 6, props.timeFrame));
            if (data.data?.items) {
                setTopDMs(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    const getNewTeamMembersList = useCallback(async () => {
        if (props.filterType === InsightsScopes.TEAM) {
            setLoading(true);
            const data: any = await dispatch(getNewTeamMembers(currentTeam.id, 0, 5, props.timeFrame));
            if (data.data?.items) {
                setNewMembers(data.data.items);
            }

            // Workaround for null response from API
            if (data.data?.items === null) {
                setNewMembers([]);
            }

            if (data.data?.total_count) {
                setTotalNewMembers(data.data.total_count);
            }
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    useEffect(() => {
        getNewTeamMembersList();
    }, [getNewTeamMembersList]);

    useEffect(() => {
        getMyTopTeamDMs();
    }, [getMyTopTeamDMs]);

    const skeletonLoader = useMemo(() => {
        const entries = [];
        for (let i = 0; i < 5; i++) {
            entries.push(
                <div
                    className='dms-loading-container'
                    key={i}
                >
                    <CircleSkeletonLoader size={72}/>
                    <div className='title-line'>
                        <RectangleSkeletonLoader
                            height={12}
                            flex='1'
                        />
                    </div>
                    <div>
                        <RectangleSkeletonLoader
                            height={8}
                            width={92}
                            margin='0 0 12px 0'
                        />
                        <RectangleSkeletonLoader
                            height={8}
                            width={72}
                        />
                    </div>
                </div>,
            );
        }
        return entries;
    }, []);

    const openInsightsModal = useCallback(() => {
        trackEvent('insights', `open_modal_${props.widgetType.toLowerCase()}`);
        dispatch(openModal({
            modalId: ModalIdentifiers.INSIGHTS,
            dialogType: InsightsModal,
            dialogProps: {
                widgetType: props.widgetType,
                title: localizeMessage('insights.newTeamMembers.title', 'New team members'),
                subtitle: '',
                filterType: props.filterType,
                timeFrame: props.timeFrame,
            },
        }));
    }, [props.widgetType, props.filterType, props.timeFrame]);

    return (
        <div className='top-dms-container'>
            {
                loading &&
                skeletonLoader
            }
            {
                (!loading && topDMs && props.filterType === InsightsScopes.MY) &&
                topDMs.map((topDM: TopDM, index: number) => {
                    const barSize = ((topDM.post_count / topDMs[0].post_count) * 0.75);
                    return (
                        <TopDMsItem
                            key={index}
                            dm={topDM}
                            barSize={barSize}
                            team={currentTeam}
                        />
                    );
                })
            }
            {
                (!loading && props.filterType === InsightsScopes.TEAM && newMembers.length > 0) && (
                    <>
                        <NewMembersTotal
                            total={totalNewMembers}
                            timeFrame={props.timeFrame}
                            openInsightsModal={openInsightsModal}
                        />
                        {newMembers.map((newMember, index) => {
                            return (
                                <NewMembersItem
                                    key={index}
                                    newMember={newMember}
                                    team={currentTeam}
                                />
                            );
                        })}
                    </>
                )
            }
            {
                (((topDMs.length === 0 && props.filterType === InsightsScopes.MY) || (newMembers.length === 0 && props.filterType === InsightsScopes.TEAM)) && !loading) &&
                <WidgetEmptyState
                    icon={'account-multiple-outline'}
                />
            }
        </div>
    );
};

export default memo(widgetHoc(TopDMsAndNewMembers));
