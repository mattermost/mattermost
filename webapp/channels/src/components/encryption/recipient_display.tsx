// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import {getUser} from 'mattermost-redux/selectors/entities/users';
import type {GlobalState} from 'types/store';

import {getChannelEncryptionInfo} from 'utils/encryption';
import type {EncryptionPublicKey} from 'utils/encryption';

type Props = {
    channelId: string;
    currentUserId: string;
    visible: boolean;
}

/**
 * Displays the list of recipients who will receive the encrypted message.
 * Shows who can decrypt and warns about users without active encryption sessions.
 */
function RecipientDisplay({channelId, currentUserId, visible}: Props) {
    const [recipients, setRecipients] = useState<EncryptionPublicKey[]>([]);
    const [usersWithoutKeys, setUsersWithoutKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !channelId) {
            return;
        }

        let isInitialFetch = true;

        const fetchRecipients = async () => {
            // Only show loading spinner on initial fetch, not refreshes
            if (isInitialFetch) {
                setLoading(true);
            }
            try {
                const info = await getChannelEncryptionInfo(channelId, currentUserId);
                setRecipients(info.recipients);
                setUsersWithoutKeys(info.usersWithoutKeys);
            } catch (error) {
                console.error('Failed to fetch channel encryption info:', error);
            } finally {
                if (isInitialFetch) {
                    setLoading(false);
                    isInitialFetch = false;
                }
            }
        };

        // Initial fetch
        fetchRecipients();

        // Refresh every 5 seconds while visible to catch new key registrations
        const intervalId = setInterval(() => {
            fetchRecipients();
        }, 5000);

        return () => {
            clearInterval(intervalId);
        };
    }, [channelId, currentUserId, visible]);

    if (!visible) {
        return null;
    }

    if (loading) {
        return (
            <div className='encryption-recipient-display'>
                <LockOutlineIcon
                    size={16}
                    className='recipient-icon'
                />
                <FormattedMessage
                    id='encryption.recipient_display.loading'
                    defaultMessage='Loading recipients...'
                />
            </div>
        );
    }

    return (
        <div className='encryption-recipient-display'>
            <LockOutlineIcon
                size={16}
                className='recipient-icon'
            />
            <div>
                <div className='recipient-list'>
                    <FormattedMessage
                        id='encryption.recipient_display.sending_to'
                        defaultMessage='Sending encrypted to: '
                    />
                    {recipients.length > 0 ? (
                        recipients.map((recipient, index) => (
                            <RecipientName
                                key={recipient.user_id}
                                userId={recipient.user_id}
                                isLast={index === recipients.length - 1}
                            />
                        ))
                    ) : (
                        <FormattedMessage
                            id='encryption.recipient_display.no_recipients'
                            defaultMessage='-'
                        />
                    )}
                </div>
                {usersWithoutKeys.length > 0 && (
                    <div className='recipient-warning'>
                        <FormattedMessage
                            id='encryption.recipient_display.warning'
                            defaultMessage='{count} member(s) without active encryption will not see this message'
                            values={{count: usersWithoutKeys.length}}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

type RecipientNameProps = {
    userId: string;
    isLast: boolean;
}

function RecipientName({userId, isLast}: RecipientNameProps) {
    const user = useSelector((state: GlobalState) => getUser(state, userId));

    const displayName = user?.username || userId;

    return (
        <span className='recipient-name'>
            {'@'}{displayName}{!isLast && ', '}
        </span>
    );
}

export default memo(RecipientDisplay);
