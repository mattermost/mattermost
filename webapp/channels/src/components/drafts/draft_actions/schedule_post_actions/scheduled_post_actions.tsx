// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {ModalIdentifiers} from 'utils/constants';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {openModal} from 'actions/views/modals';

import ScheduledPostCustomTimeModal
    from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';
import Action from 'components/drafts/draft_actions/action';
import DeleteScheduledPostModal
    from 'components/drafts/draft_actions/schedule_post_actions/delete_scheduled_post_modal';

import './style.scss';

type Props = {
    scheduledPost: ScheduledPost;
    channelDisplayName: string;
    onReschedule: (timestamp: number) => void;
    onDelete: (id: string) => void;
}

function ScheduledPostActions({scheduledPost, onReschedule, onDelete, channelDisplayName}: Props) {
    const dispatch = useDispatch();

    const handleConfirmRescheduledPost = useCallback((timestamp: number) => {
        onReschedule(timestamp);
    }, [onReschedule]);

    const handleReschedulePost = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SCHEDULED_POST_CUSTOM_TIME_MODAL,
            dialogType: ScheduledPostCustomTimeModal,
            dialogProps: {
                channelId: scheduledPost.channel_id,
                onConfirm: handleConfirmRescheduledPost,
            },
        }));
    }, [dispatch, handleConfirmRescheduledPost, scheduledPost.channel_id]);

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.DELETE_DRAFT,
            dialogType: DeleteScheduledPostModal,
            dialogProps: {
                channelDisplayName,
                onConfirm: () => onDelete(scheduledPost.id),
            },
        }));
    }, [channelDisplayName, dispatch, onDelete, scheduledPost.id]);

    return (
        <div className='ScheduledPostActions'>
            <Action
                icon='icon-trash-can-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='scheduled_post.action.delete'
                        defaultMessage='Delete scheduled post'
                    />
                )}
                onClick={handleDelete}
            />

            {
                !scheduledPost.error_code && (
                    <React.Fragment>
                        <Action
                            icon='icon-pencil-outline'
                            id='delete'
                            name='delete'
                            tooltipText={(
                                <FormattedMessage
                                    id='scheduled_post.action.edit'
                                    defaultMessage='Edit scheduled post'
                                />
                            )}
                            onClick={() => {}}
                        />

                        <Action
                            icon='icon-clock-send-outline'
                            id='delete'
                            name='delete'
                            tooltipText={(
                                <FormattedMessage
                                    id='scheduled_post.action.rescheduled'
                                    defaultMessage='Reschedule post'
                                />
                            )}
                            onClick={handleReschedulePost}
                        />

                        <Action
                            icon='icon-send-outline'
                            id='delete'
                            name='delete'
                            tooltipText={(
                                <FormattedMessage
                                    id='scheduled_post.action.send_now'
                                    defaultMessage='Send now'
                                />
                            )}
                            onClick={() => {}}
                        />
                    </React.Fragment>
                )
            }

        </div>
    );
}

export default memo(ScheduledPostActions);
