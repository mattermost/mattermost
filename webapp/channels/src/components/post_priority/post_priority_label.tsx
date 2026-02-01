// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PostPriority} from '@mattermost/types/posts';

import {openModal} from 'actions/views/modals';
import KeypairPromptModal from 'components/encryption/keypair_prompt_modal';
import Tag from 'components/widgets/tag/tag';
import type {TagSize} from 'components/widgets/tag/tag';
import WithTooltip from 'components/with_tooltip';
import {ModalIdentifiers} from 'utils/constants';
import {isEncryptionInitialized, ensureEncryptionKeys} from 'utils/encryption/session';

type Props = {
    priority?: PostPriority|'';
    size?: TagSize;
    uppercase?: boolean;
}

export default function PriorityLabel({
    priority,
    ...rest
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleEncryptedClick = useCallback(() => {
        if (isEncryptionInitialized()) {
            return; // User already has keys, no action needed
        }

        const handleConfirm = async () => {
            await ensureEncryptionKeys();
            window.location.reload();
        };

        const handleDismiss = () => {
            // Do nothing on dismiss
        };

        dispatch(openModal({
            modalId: ModalIdentifiers.KEYPAIR_PROMPT_MODAL,
            dialogType: KeypairPromptModal,
            dialogProps: {
                onConfirm: handleConfirm,
                onDismiss: handleDismiss,
            },
        }));
    }, [dispatch]);

    if (priority === PostPriority.URGENT) {
        return (
            <Tag
                {...rest}
                variant='danger'
                icon={'alert-outline'}
                text={formatMessage({id: 'post_priority.priority.urgent', defaultMessage: 'Urgent'})}
                uppercase={true}
                data-testid='post-priority-label'
            />
        );
    }

    if (priority === PostPriority.IMPORTANT) {
        return (
            <Tag
                {...rest}
                variant='info'
                icon={'alert-circle-outline'}
                text={formatMessage({id: 'post_priority.priority.important', defaultMessage: 'Important'})}
                uppercase={true}
                data-testid='post-priority-label'
            />
        );
    }

    if (priority === PostPriority.ENCRYPTED) {
        const hasKeys = isEncryptionInitialized();
        const tag = (
            <Tag
                {...rest}
                variant='info'
                icon={'lock-outline'}
                text={formatMessage({id: 'post_priority.priority.encrypted', defaultMessage: 'Encrypted'})}
                uppercase={true}
                data-testid='post-priority-label'
                className={`encrypted-priority-tag${!hasKeys ? ' encrypted-priority-tag--clickable' : ''}`}
                onClick={!hasKeys ? handleEncryptedClick : undefined}
            />
        );

        if (!hasKeys) {
            return (
                <WithTooltip
                    title={formatMessage({id: 'post_priority.encrypted.setup_hint', defaultMessage: 'Click to set up encryption'})}
                >
                    {tag}
                </WithTooltip>
            );
        }

        return tag;
    }

    return null;
}
