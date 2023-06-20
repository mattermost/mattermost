// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import classNames from 'classnames';

import Tag from 'components/widgets/tag/tag';

import {selectPostAndParentChannel} from 'actions/views/rhs';
import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import {getMyTopThreads as fetchMyTopThreads, getTopThreadsForTeam} from 'mattermost-redux/actions/insights';

import {TimeFrame, TopThread} from '@mattermost/types/insights';
import {UserProfile} from '@mattermost/types/users';
import {GlobalState} from '@mattermost/types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {InsightsScopes, ModalIdentifiers} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import Avatar from 'components/widgets/users/avatar';
import Avatars from 'components/widgets/users/avatars';
import Markdown from 'components/markdown';
import Attachment from 'components/threading/global_threads/thread_item/attachments';
import DataGrid, {Row, Column} from 'components/admin_console/data_grid/data_grid';

import JoinChannelModal from '../../join_channel_modal/join_channel_modal';

import './../../../activity_and_insights.scss';
import '../top_threads.scss';

type Props = {
    filterType: string;
    timeFrame: TimeFrame;
    closeModal: () => void;
}

const TopThreadsTable = (props: Props) => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    const [topThreads, setTopThreads] = useState([] as TopThread[]);

    const currentTeamId = useSelector(getCurrentTeamId);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const myChannelMemberships = useSelector(getMyChannelMemberships);
    const complianceExportEnabled = useSelector((state: GlobalState) => state.entities.general.config.EnableComplianceExport);
    const license = useSelector(getLicense);

    const getTopTeamThreads = useCallback(async () => {
        if (props.filterType === InsightsScopes.TEAM) {
            setLoading(true);
            const data: any = await dispatch(getTopThreadsForTeam(currentTeamId, 0, 5, props.timeFrame));
            if (data.data && data.data.items) {
                setTopThreads(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, currentTeamId, props.filterType]);

    useEffect(() => {
        getTopTeamThreads();
    }, [getTopTeamThreads]);

    const getMyTopThreads = useCallback(async () => {
        if (props.filterType === InsightsScopes.MY) {
            setLoading(true);
            const data: any = await dispatch(fetchMyTopThreads(currentTeamId, 0, 5, props.timeFrame));
            if (data.data && data.data.items) {
                setTopThreads(data.data.items);
            }
            setLoading(false);
        }
    }, [props.timeFrame, props.filterType]);

    useEffect(() => {
        getMyTopThreads();
    }, [getMyTopThreads]);

    const imageProps = useMemo(() => ({
        onImageHeightChanged: () => {},
        onImageLoaded: () => {},
    }), []);

    const closeModal = useCallback(() => {
        props.closeModal();
    }, [props.closeModal]);

    const openRHSOrJoinChannel = useCallback((thread: TopThread, isChannelMember: boolean) => {
        if (!isChannelMember && (license.Compliance === 'true' && complianceExportEnabled === 'true')) {
            dispatch(openModal({
                modalId: ModalIdentifiers.INSIGHTS,
                dialogType: JoinChannelModal,
                dialogProps: {
                    thread,
                    currentTeamId,
                },
            }));
        } else {
            trackEvent('insights', 'open_thread_from_top_threads_modal');
            dispatch(selectPostAndParentChannel(thread.post));
        }
        closeModal();
    }, [currentTeamId]);

    const getPreview = useCallback((thread: TopThread, isChannelMember: boolean) => {
        if (!isChannelMember && (license.Compliance === 'true' && complianceExportEnabled === 'true')) {
            return (
                <span className='compliance-information'>
                    <FormattedMessage
                        id='insights.topThreadItem.notChannelMember'
                        defaultMessage={'You\'ll need to join the {channel} channel to see this thread.'}
                        values={{
                            channel: <strong>{thread.channel_display_name}</strong>,
                        }}
                    />
                </span>
            );
        }

        if (thread.post.message) {
            return (
                <Markdown
                    message={thread.post.message}
                    options={{
                        singleline: true,
                        mentionHighlight: false,
                        atMentions: false,
                    }}
                    imagesMetadata={thread.post?.metadata && thread.post?.metadata?.images}
                    imageProps={imageProps}
                />
            );
        }

        return (
            <Attachment post={thread.post}/>
        );
    }, []);

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
                        id='insights.topThreads.thread'
                        defaultMessage='Thread'
                    />
                ),
                field: 'thread',
                width: 0.7,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topThreads.totalMessages'
                        defaultMessage='Participants'
                    />
                ),
                field: 'participants',
                width: 0.15,
            },
            {
                name: (
                    <FormattedMessage
                        id='insights.topThreads.replies'
                        defaultMessage='Replies'
                    />
                ),
                field: 'replies',
                width: 0.08,
            },
        ];
        return columns;
    }, []);

    const getRows = useMemo((): Row[] => {
        return topThreads.map((thread, i) => {
            const channelMembership = myChannelMemberships[thread.channel_id];
            let isChannelMember = false;
            if (typeof channelMembership !== 'undefined') {
                isChannelMember = true;
            }

            return (
                {
                    cells: {
                        rank: (
                            <span className='cell-text'>
                                {i + 1}
                            </span>
                        ),
                        thread: (
                            <div className='thread-item'>
                                <div className='thread-details'>
                                    <Avatar
                                        url={imageURLForUser(thread.user_information.id)}
                                        size={'xs'}
                                    />
                                    <span className='display-name'>{displayUsername(thread.user_information as UserProfile, teammateNameDisplaySetting)}</span>
                                    <Tag text={thread.channel_display_name}/>
                                </div>
                                <div
                                    className='preview'
                                >
                                    {getPreview(thread, isChannelMember)}
                                </div>
                            </div>
                        ),
                        participants: (
                            <>
                                {thread.participants && thread.participants.length > 0 ? (
                                    <Avatars
                                        userIds={thread.participants}
                                        size='xs'
                                        disableProfileOverlay={true}
                                    />
                                ) : null}
                            </>

                        ),
                        replies: (
                            <span className='replies'>{thread.post.reply_count}</span>
                        ),
                    },
                    onClick: () => {
                        openRHSOrJoinChannel(thread, isChannelMember);
                    },
                }
            );
        });
    }, [topThreads, myChannelMemberships]);

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
            className={classNames('InsightsTable', 'TopThreadsTable')}
        />
    );
};

export default memo(TopThreadsTable);
