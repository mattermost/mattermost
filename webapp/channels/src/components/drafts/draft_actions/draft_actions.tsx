// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import ScheduledPostCustomTimeModal
    from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';

import {ModalIdentifiers} from 'utils/constants';

import Action from './action';
import DeleteDraftModal from './delete_draft_modal';
import SendDraftModal from './send_draft_modal';

const scheduledDraft = (
    <FormattedMessage
        id='drafts.actions.scheduled'
        defaultMessage='Schedule draft'
    />
);

type Props = {
    displayName: string;
    onDelete: () => void;
    onEdit: () => void;
    onSend: () => void;
    canEdit: boolean;
    canSend: boolean;
    onSchedule: (timestamp: number) => Promise<{error?: string}>;
    channelId: string;
}

function DraftActions({
    displayName,
    onDelete,
    onEdit,
    onSend,
    canEdit,
    canSend,
    onSchedule,
    channelId,
}: Props) {
    const dispatch = useDispatch();

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.DELETE_DRAFT,
            dialogType: DeleteDraftModal,
            dialogProps: {
                displayName,
                onConfirm: onDelete,
            },
        }));
    }, [dispatch, displayName, onDelete]);

    const handleSend = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SEND_DRAFT,
            dialogType: SendDraftModal,
            dialogProps: {
                displayName,
                onConfirm: onSend,
            },
        }));
    }, [dispatch, displayName, onSend]);

    const handleScheduleDraft = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SCHEDULED_POST_CUSTOM_TIME_MODAL,
            dialogType: ScheduledPostCustomTimeModal,
            dialogProps: {
                channelId,
                onConfirm: onSchedule,
            },
        }));
    }, [channelId, dispatch, onSchedule]);

    return (
        <>
            <Action
                icon='icon-trash-can-outline'
                id='delete'
                name='delete'
                tooltipText={(
                    <FormattedMessage
                        id='drafts.actions.delete'
                        defaultMessage='Delete draft'
                    />
                )}
                onClick={handleDelete}
            />
            {canEdit && (
                <Action
                    icon='icon-pencil-outline'
                    id='edit'
                    name='edit'
                    tooltipText={(
                        <FormattedMessage
                            id='drafts.actions.edit'
                            defaultMessage='Edit draft'
                        />
                    )}
                    onClick={onEdit}
                />
            )}

            {
                canSend &&
                <Action
                    icon='icon-clock-send-outline'
                    id='reschedule'
                    name='reschedule'
                    tooltipText={scheduledDraft}
                    onClick={handleScheduleDraft}
                />
            }

            {canSend && (
                <Action
                    icon='icon-send-outline'
                    id='send'
                    name='send'
                    tooltipText={(
                        <FormattedMessage
                            id='drafts.actions.send'
                            defaultMessage='Send draft'
                        />
                    )}
                    onClick={handleSend}
                />
            )}
        </>
    );
}

export default memo(DraftActions);
