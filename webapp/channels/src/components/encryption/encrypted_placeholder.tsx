// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

/**
 * Placeholder shown when user cannot decrypt an encrypted message.
 * This appears when:
 * - User doesn't have encryption keys initialized
 * - User is not in the list of recipients for the message
 */
function EncryptedPlaceholder() {
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
                    <FormattedMessage
                        id='encryption.placeholder.message'
                        defaultMessage='You do not have permission to view this message'
                    />
                </div>
            </div>
        </div>
    );
}

export default memo(EncryptedPlaceholder);
