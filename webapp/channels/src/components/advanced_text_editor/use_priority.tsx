// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {isPostPriorityEnabled as isPostPriorityEnabledSelector} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import PersistNotificationConfirmModal from 'components/persist_notification_confirm_modal';
import PostPriorityPickerOverlay from 'components/post_priority/post_priority_picker_overlay';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {hasRequestedPersistentNotifications, mentionsMinusSpecialMentionsInText, specialMentionsInText} from 'utils/post_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import PriorityLabels from './priority_labels';

const usePriority = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void),
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
) => {
    const dispatch = useDispatch();
    const rootId = draft.rootId;
    const channelId = draft.channelId;

    const isPostPriorityEnabled = useSelector(isPostPriorityEnabledSelector);
    const channelType = useSelector((state: GlobalState) => getChannel(state, channelId)?.type || 'O');
    const channelTeammateUsername = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return getUser(state, channel?.teammate_id || '')?.username || '';
    });

    const hasPrioritySet = isPostPriorityEnabled &&
    draft.metadata?.priority &&
    (
        draft.metadata.priority.priority ||
        draft.metadata.priority.requested_ack
    );

    const specialMentions = useMemo(() => {
        return specialMentionsInText(draft.message);
    }, [draft.message]);

    const hasSpecialMentions = useMemo(() => {
        return Object.values(specialMentions).includes(true);
    }, [specialMentions]);

    const isValidPersistentNotifications = useMemo(() => {
        if (!hasPrioritySet) {
            return true;
        }

        const {priority, persistent_notifications: persistentNotifications} = draft.metadata!.priority!;
        if (priority !== PostPriority.URGENT || !persistentNotifications) {
            return true;
        }

        if (channelType === Constants.DM_CHANNEL) {
            return true;
        }

        if (hasSpecialMentions) {
            return false;
        }

        const mentions = mentionsMinusSpecialMentionsInText(draft.message);

        return mentions.length > 0;
    }, [hasPrioritySet, draft, channelType, hasSpecialMentions]);

    const handlePostPriorityApply = useCallback((settings?: PostPriorityMetadata) => {
        const updatedDraft = {
            ...draft,
        };

        if (settings?.priority || settings?.requested_ack) {
            updatedDraft.metadata = {
                priority: {
                    ...settings,
                    priority: settings!.priority || '',
                    requested_ack: settings!.requested_ack,
                },
            };
        } else {
            updatedDraft.metadata = {};
        }

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [focusTextbox, draft, handleDraftChange]);

    const handlePostPriorityHide = useCallback(() => {
        focusTextbox(true);
    }, [focusTextbox]);

    const handleRemovePriority = useCallback(() => {
        handlePostPriorityApply();
    }, [handlePostPriorityApply]);

    const showPersistNotificationModal = useCallback((message: string, specialMentions: {[key: string]: boolean}, channelType: Channel['type'], onConfirm: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.PERSIST_NOTIFICATION_CONFIRM_MODAL,
            dialogType: PersistNotificationConfirmModal,
            dialogProps: {
                currentChannelTeammateUsername: channelTeammateUsername,
                specialMentions,
                channelType,
                message,
                onConfirm,
            },
        }));
    }, [channelTeammateUsername, dispatch]);

    const onSubmitCheck = useCallback((onConfirm: () => void) => {
        if (
            isPostPriorityEnabled &&
            hasRequestedPersistentNotifications(draft?.metadata?.priority)
        ) {
            showPersistNotificationModal(draft.message, specialMentions, channelType, onConfirm);
            return true;
        }
        return false;
    }, [isPostPriorityEnabled, showPersistNotificationModal, draft, channelType, specialMentions]);

    const labels = useMemo(() => (
        (hasPrioritySet && !rootId) ? (
            <PriorityLabels
                canRemove={!shouldShowPreview}
                hasError={!isValidPersistentNotifications}
                specialMentions={specialMentions}
                onRemove={handleRemovePriority}
                persistentNotifications={draft!.metadata!.priority?.persistent_notifications}
                priority={draft!.metadata!.priority?.priority}
                requestedAck={draft!.metadata!.priority?.requested_ack}
            />
        ) : undefined
    ), [hasPrioritySet, rootId, shouldShowPreview, isValidPersistentNotifications, specialMentions, handleRemovePriority, draft]);

    const additionalControl = useMemo(() =>
        !rootId && isPostPriorityEnabled && (
            <PostPriorityPickerOverlay
                key='post-priority-picker-key'
                settings={draft.metadata?.priority}
                onApply={handlePostPriorityApply}
                onClose={handlePostPriorityHide}
                disabled={shouldShowPreview}
            />
        ), [rootId, isPostPriorityEnabled, draft.metadata?.priority, handlePostPriorityApply, handlePostPriorityHide, shouldShowPreview]);

    return {
        labels,
        additionalControl,
        isValidPersistentNotifications,
        onSubmitCheck,
    };
};

export default usePriority;
