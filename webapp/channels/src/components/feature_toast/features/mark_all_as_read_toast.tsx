// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Preferences} from 'mattermost-redux/constants';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import usePreference from 'components/common/hooks/usePreference';
import {ShortcutSequence, ShortcutKeyVariant} from 'components/shortcut_sequence';
import {ShortcutKeys} from 'components/with_tooltip';

import * as UserAgent from 'utils/user_agent';

import FeatureToast from '../feature_toast';

export default function MarkAllAsReadToast() {
    const {formatMessage} = useIntl();
    const enableMarkAllReadShortcut = useGetFeatureFlagValue('EnableShiftEscapeToMarkAllRead') === 'true';
    const [userHasSeenMarkAllReadToast, setUserHasSeenMarkAllReadToast] = usePreference(
        Preferences.CATEGORY_NEW_FEATURES,
        Preferences.HAS_SEEN_MARK_ALL_READ_FEATURE,
    );
    const [show, setShow] = useState(
        enableMarkAllReadShortcut &&
        !UserAgent.isMobile() &&
        !userHasSeenMarkAllReadToast,
    );

    if (!enableMarkAllReadShortcut) {
        return null;
    }

    const onDismiss = () => {
        setShow(false);
        setUserHasSeenMarkAllReadToast('true');
    };

    const titleText = formatMessage({
        id: 'mark_all_as_read_toast.title',
        defaultMessage: 'A new shortcut to clear unreads',
    });

    const message = (
        <FormattedMessage
            id='mark_all_as_read_toast.message'
            defaultMessage="Now you can use {shortcut} to mark all of your messages for this team as read. Don't worry, you'll be asked to confirm."
            values={{
                shortcut: (
                    <ShortcutSequence
                        keys={[ShortcutKeys.shift, ShortcutKeys.esc]}
                        variant={ShortcutKeyVariant.InlineContent}
                    />
                ),
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
