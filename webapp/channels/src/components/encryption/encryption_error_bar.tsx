// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';
import {clearEncryptionKeyError, setEncryptionKeyError} from 'actions/views/encryption';
import {ensureEncryptionKeys} from 'utils/encryption/session';

import type {GlobalState} from 'types/store';

/**
 * Shows an error banner when encryption key registration fails.
 * Provides a retry button to attempt registration again.
 */
const EncryptionKeyErrorBar = () => {
    const dispatch = useDispatch();
    const error = useSelector((state: GlobalState) => state.views.encryption?.keyError);

    const handleRetry = useCallback(async () => {
        dispatch(clearEncryptionKeyError());
        try {
            await ensureEncryptionKeys();
        } catch (err) {
            // Set the error again if retry fails
            dispatch(setEncryptionKeyError(
                err instanceof Error ? err.message : 'Failed to register encryption keys',
            ));
        }
    }, [dispatch]);

    const handleDismiss = useCallback(() => {
        dispatch(clearEncryptionKeyError());
    }, [dispatch]);

    if (!error) {
        return null;
    }

    return (
        <AnnouncementBar
            id='encryption-key-error-bar'
            type={AnnouncementBarTypes.CRITICAL}
            showCloseButton={true}
            handleClose={handleDismiss}
            showLinkAsButton={true}
            icon={<LockOutlineIcon size={16}/>}
            message={
                <FormattedMessage
                    id='encryption.error_bar.message'
                    defaultMessage='Failed to register encryption keys. You will not be able to send or receive encrypted messages.'
                />
            }
            ctaText={
                <FormattedMessage
                    id='encryption.error_bar.retry'
                    defaultMessage='Retry'
                />
            }
            onButtonClick={handleRetry}
        />
    );
};

export default EncryptionKeyErrorBar;
