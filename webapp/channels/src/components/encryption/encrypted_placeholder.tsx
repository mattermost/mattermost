// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import {ensureEncryptionKeys} from 'utils/encryption/session';

import KeypairPromptModal from './keypair_prompt_modal';

type EncryptionStatus = 'no_keys' | 'no_access' | 'decrypt_error';

interface Props {
    status?: EncryptionStatus;
}

/**
 * Placeholder shown when user cannot decrypt an encrypted message.
 * This appears when:
 * - User doesn't have encryption keys initialized (no_keys)
 * - User is not in the list of recipients for the message (no_access)
 * - Decryption failed for some reason (decrypt_error)
 */
function EncryptedPlaceholder({status = 'no_access'}: Props) {
    const dispatch = useDispatch();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateKeys = useCallback(async () => {
        setIsGenerating(true);
        try {
            await ensureEncryptionKeys();
            // Reload the page to re-attempt decryption of all messages
            window.location.reload();
        } catch (error) {
            console.error('Failed to generate encryption keys:', error);
            setIsGenerating(false);
        }
    }, []);

    const handleOpenModal = useCallback(() => {
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

    const getMessage = () => {
        switch (status) {
        case 'no_keys':
            return (
                <FormattedMessage
                    id='encryption.placeholder.no_keys'
                    defaultMessage='Set up encryption to view this message'
                />
            );
        case 'decrypt_error':
            return (
                <FormattedMessage
                    id='encryption.placeholder.decrypt_error'
                    defaultMessage='Unable to decrypt this message'
                />
            );
        case 'no_access':
        default:
            return (
                <FormattedMessage
                    id='encryption.placeholder.no_access'
                    defaultMessage='You do not have permission to view this message'
                />
            );
        }
    };

    const isClickable = status === 'no_keys';

    return (
        <div
            className={`encrypted-placeholder${isClickable ? ' encrypted-placeholder--clickable' : ''}`}
            onClick={isClickable ? handleOpenModal : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenModal();
                }
            } : undefined}
        >
            <div className='encrypted-placeholder-icon'>
                <LockOutlineIcon size={24}/>
            </div>
            <div className='encrypted-placeholder-content'>
                <div className='encrypted-placeholder-title'>
                    <FormattedMessage
                        id='encryption.placeholder.title'
                        defaultMessage='Encrypted Message'
                    />
                </div>
                <div className='encrypted-placeholder-message'>
                    {getMessage()}
                </div>
            </div>
            {status === 'no_keys' && (
                <button
                    type='button'
                    className='btn btn-primary encrypted-placeholder-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateKeys();
                    }}
                    disabled={isGenerating}
                >
                    {isGenerating ? (
                        <FormattedMessage
                            id='encryption.placeholder.generating'
                            defaultMessage='Setting up...'
                        />
                    ) : (
                        <FormattedMessage
                            id='encryption.placeholder.generate_keys'
                            defaultMessage='Set Up Encryption'
                        />
                    )}
                </button>
            )}
        </div>
    );
}

export default memo(EncryptedPlaceholder);
