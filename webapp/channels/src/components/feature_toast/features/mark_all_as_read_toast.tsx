// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import LocalStorageStore from 'stores/local_storage_store';

import * as UserAgent from 'utils/user_agent';

import {FeaturesToAnnounce} from '..';
import FeatureToast from '../feature_toast';

export default function MarkAllAsReadToast() {
    const {formatMessage} = useIntl();
    const [show, setShow] = useState(!UserAgent.isMobile() &&
        !LocalStorageStore.getHasSeenFeatureToast(
            FeaturesToAnnounce.MARK_ALL_AS_READ_SHORTCUT,
        ),
    );

    const onDismiss = () => {
        setShow(false);
        LocalStorageStore.setHasSeenFeatureToast(
            FeaturesToAnnounce.MARK_ALL_AS_READ_SHORTCUT,
            true,
        );
    };

    const titleText = formatMessage({
        id: 'mark_all_as_read_toast.title',
        defaultMessage: 'A new shortcut to clear unreads',
    });

    const message = (
        <FormattedMessage
            id='mark_all_as_read_toast.message'
            defaultMessage="Now you can use {shift} {escape} to mark all of your messages for this team as read. Don't worry, you'll be asked to confirm."
            values={{
                shift: <kbd>
                    <FormattedMessage
                        id='keyboard.shift'
                        defaultMessage='Shift'
                    />
                </kbd>,
                escape: <kbd>
                    <FormattedMessage
                        id='keyboard.escape'
                        defaultMessage='ESC'
                    />
                </kbd>,
            }}
        />
    );

    const buttonText = formatMessage({
        id: 'mark_all_as_read_toast.button',
        defaultMessage: 'Got it',
    });

    return (
        <FeatureToast
            show={show}
            showButton={true}
            title={titleText}
            message={message}
            buttonText={buttonText}
            onDismiss={onDismiss}
        />
    );
}
