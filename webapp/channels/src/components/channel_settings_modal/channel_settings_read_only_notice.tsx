// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertBanner from 'components/alert_banner';

/**
 * Explains why every control in the channel settings modal is disabled: an attribute-based
 * policy denies channel_management_access, and editing a channel's settings is managing it.
 *
 * The tabs stay visible and read-only rather than disappearing, because a policy denial
 * usually hides every tab at once and an empty modal tells the user nothing.
 *
 * System admins never see it: channel_management_access does not bind manage_system.
 */
export default function ChannelSettingsReadOnlyNotice() {
    return (
        <AlertBanner
            mode='info'
            variant='app'
            className='ChannelSettingsModal__readOnlyNotice'
            title={
                <FormattedMessage
                    id='channel_settings.read_only.title'
                    defaultMessage='Editing is restricted'
                />
            }
            message={
                <FormattedMessage
                    id='channel_settings.read_only.message'
                    defaultMessage='An access policy prevents you from making changes in this channel. These settings are shown for reference only.'
                />
            }
        />
    );
}
