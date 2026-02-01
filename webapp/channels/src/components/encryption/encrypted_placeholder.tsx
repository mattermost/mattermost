// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

type EncryptionStatus = 'no_keys' | 'no_access' | 'decrypt_error';

interface Props {
    status?: EncryptionStatus;
}

/**
 * Placeholder shown when user cannot decrypt an encrypted message.
 * This appears when:
 * - User doesn't have encryption keys initialized (no_keys) - rare, keys are auto-generated
 * - User is not in the list of recipients for the message (no_access)
 * - Decryption failed for some reason (decrypt_error)
 */
function EncryptedPlaceholder({status = 'no_access'}: Props) {
    const getMessage = () => {
        switch (status) {
        case 'no_keys':
            return (
                <FormattedMessage
                    id='encryption.placeholder.no_keys'
                    defaultMessage='Encryption keys not available. Try refreshing the page.'
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
        </div>
    );
}

export default memo(EncryptedPlaceholder);
