// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {isPostPriorityEnabled as isPostPriorityEnabledSelector} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {isEncryptionEnabled as isEncryptionEnabledSelector} from 'selectors/general';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import PersistNotificationConfirmModal from 'components/persist_notification_confirm_modal';
import PostPriorityPicker from 'components/post_priority/post_priority_picker';
import WithTooltip from 'components/with_tooltip';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {hasRequestedPersistentNotifications, mentionsMinusSpecialMentionsInText, specialMentionsInText} from 'utils/post_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import PriorityLabels from './priority_labels';

const usePriority = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: { instant?: boolean; show?: boolean }) => void),
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
    showIndividualCloseButton = true,
) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const rootId = draft.rootId;
    const channelId = draft.channelId;

    const isPostPriorityEnabled = useSelector(isPostPriorityEnabledSelector);
    const isEncryptionEnabled = useSelector(isEncryptionEnabledSelector);
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
                ...updatedDraft.metadata,
                priority: {
                    ...settings,
                    priority: settings!.priority || '',
                    requested_ack: settings!.requested_ack,
                },
            };
        } else {
            // Remove priority but keep other metadata
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {priority, ...restMetadata} = updatedDraft.metadata || {};
            updatedDraft.metadata = restMetadata;
        }

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [focusTextbox, draft, handleDraftChange]);

    const handlePostPriorityHide = useCallback(() => {
        focusTextbox(true);
    }, [focusTextbox]);

    const handleEncryptionToggle = useCallback(() => {
        const isEncrypted = draft.metadata?.priority?.priority === PostPriority.ENCRYPTED;
        if (isEncrypted) {
            handlePostPriorityApply({
                ...draft.metadata?.priority,
                priority: '',
            } as PostPriorityMetadata);
        } else {
            handlePostPriorityApply({
                ...draft.metadata?.priority,
                priority: PostPriority.ENCRYPTED,
            } as PostPriorityMetadata);
        }
    }, [draft.metadata?.priority, handlePostPriorityApply]);

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
                canRemove={showIndividualCloseButton && !shouldShowPreview}
                hasError={!isValidPersistentNotifications}
                specialMentions={specialMentions}
                onRemove={handleRemovePriority}
                persistentNotifications={draft!.metadata!.priority?.persistent_notifications}
                priority={draft!.metadata!.priority?.priority}
                requestedAck={draft!.metadata!.priority?.requested_ack}
            />
        ) : undefined
    ), [hasPrioritySet, rootId, showIndividualCloseButton, shouldShowPreview, isValidPersistentNotifications, specialMentions, handleRemovePriority, draft]);

    const additionalControl = useMemo(() =>
        !rootId && isPostPriorityEnabled && (
            <PostPriorityPicker
                key='post-priority-picker-key'
                settings={draft.metadata?.priority}
                onApply={handlePostPriorityApply}
                onClose={handlePostPriorityHide}
                disabled={shouldShowPreview}
            />
        ), [rootId, isPostPriorityEnabled, draft.metadata?.priority, handlePostPriorityApply, handlePostPriorityHide, shouldShowPreview]);

    const encryptionControl = useMemo(() =>
        !rootId && isEncryptionEnabled && (
            <WithTooltip
                key='encryption-toggle'
                title={formatMessage({id: 'post_priority.encryption.toggle', defaultMessage: 'Toggle encryption'})}
            >
                <IconContainer
                    className={classNames('encryption-toggle-button', {active: draft.metadata?.priority?.priority === PostPriority.ENCRYPTED})}
                    onClick={handleEncryptionToggle}
                    disabled={shouldShowPreview}
                    type='button'
                >
                    <LockOutlineIcon
                        size={18}
                        color='currentColor'
                    />
                </IconContainer>
            </WithTooltip>
        ), [rootId, isEncryptionEnabled, formatMessage, draft.metadata?.priority?.priority, handleEncryptionToggle, shouldShowPreview]);

    const isEncrypted = draft.metadata?.priority?.priority === PostPriority.ENCRYPTED;

    return {
        labels,
        additionalControl,
        encryptionControl,
        isEncrypted,
        isValidPersistentNotifications,
        onSubmitCheck,
        handleRemovePriority,
    };
};

export default usePriority;
