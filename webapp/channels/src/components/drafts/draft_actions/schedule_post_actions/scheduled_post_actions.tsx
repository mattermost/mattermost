// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {openModal} from 'actions/views/modals';

import ScheduledPostCustomTimeModal
    from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';
import Action from 'components/drafts/draft_actions/action';
import DeleteScheduledPostModal
    from 'components/drafts/draft_actions/schedule_post_actions/delete_scheduled_post_modal';
import SendDraftModal from 'components/drafts/draft_actions/send_draft_modal';

import {ModalIdentifiers} from 'utils/constants';

import './style.scss';

const deleteTooltipText = (
    <FormattedMessage
        id='scheduled_post.action.delete'
        defaultMessage='Delete scheduled post'
    />
);

const editTooltipText = (
    <FormattedMessage
        id='scheduled_post.action.edit'
        defaultMessage='Edit scheduled post'
    />
);

const rescheduleTooltipText = (
    <FormattedMessage
        id='scheduled_post.action.reschedule'
        defaultMessage='Reschedule post'
    />
);

const sendNowTooltipText = (
    <FormattedMessage
        id='scheduled_post.action.send_now'
        defaultMessage='Send now'
    />
);

type Props = {
    scheduledPost: ScheduledPost;
    channelDisplayName: string;
    onReschedule: (timestamp: number) => Promise<{error?: string}>;
    onDelete: (scheduledPostId: string) => Promise<{error?: string}>;
    onSend: (scheduledPostId: string) => void;
    onEdit: () => void;
}

function ScheduledPostActions({scheduledPost, onReschedule, onDelete, channelDisplayName, onSend, onEdit}: Props) {
    const dispatch = useDispatch();
    const userTimezone = useSelector(getCurrentTimezone);

    const handleReschedulePost = useCallback(() => {
        const initialTime = moment.tz(scheduledPost.scheduled_at, userTimezone);

        dispatch(openModal({
            modalId: ModalIdentifiers.SCHEDULED_POST_CUSTOM_TIME_MODAL,
            dialogType: ScheduledPostCustomTimeModal,
            dialogProps: {
                channelId: scheduledPost.channel_id,
                onConfirm: onReschedule,
                initialTime,
            },
        }));
    }, [dispatch, onReschedule, scheduledPost.channel_id, scheduledPost.scheduled_at, userTimezone]);

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

    const handleSend = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SEND_DRAFT,
            dialogType: SendDraftModal,
            dialogProps: {
                displayName: channelDisplayName,
                onConfirm: () => onSend(scheduledPost.id),
            },
        }));
    }, [channelDisplayName, dispatch, onSend, scheduledPost.id]);

    return (
        <div className='ScheduledPostActions'>
            <Action
                icon='icon-trash-can-outline'
                id='delete'
                name='delete'
                tooltipText={deleteTooltipText}
                onClick={handleDelete}
            />

            {
                !scheduledPost.error_code && (
                    <React.Fragment>
                        <Action
                            icon='icon-pencil-outline'
                            id='edit'
                            name='edit'
                            tooltipText={editTooltipText}
                            onClick={onEdit}

                        />

                        <Action
                            icon='icon-clock-send-outline'
                            id='reschedule'
                            name='reschedule'
                            tooltipText={rescheduleTooltipText}
                            onClick={handleReschedulePost}
                        />

                        <Action
                            icon='icon-send-outline'
                            id='sendNow'
                            name='sendNow'
                            tooltipText={sendNowTooltipText}
                            onClick={handleSend}
                        />
                    </React.Fragment>
                )
            }

        </div>
    );
}

export default memo(ScheduledPostActions);
