// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import {ensureEncryptionKeys} from 'utils/encryption/session';

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
    const handleGenerateKeys = useCallback(async () => {
        try {
            await ensureEncryptionKeys();
            // Reload the page to re-attempt decryption of all messages
            window.location.reload();
        } catch (error) {
            console.error('Failed to generate encryption keys:', error);
        }
    }, []);

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

    return (
        <div className='encrypted-placeholder'>
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
                    onClick={handleGenerateKeys}
                >
                    <FormattedMessage
                        id='encryption.placeholder.generate_keys'
                        defaultMessage='Set Up Encryption'
                    />
                </button>
            )}
        </div>
    );
}

export default memo(EncryptedPlaceholder);
