// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import AlertBanner from 'components/alert_banner';

import type {GlobalState} from 'types/store';

/**
 * Explains why every control in the channel settings modal is disabled: an attribute-based
 * policy denies channel_write_access, and editing a channel's settings is a write to it.
 *
 * The tabs stay visible and read-only rather than disappearing, because a policy denial
 * usually hides every tab at once and an empty modal tells the user nothing.
 *
 * System admins see a different message. The server exempts manage_system from the gate,
 * so for them this really is a "not from here" rather than a "not at all", and a plain
 * read-only banner would read as a dead end.
 */
export default function ChannelSettingsReadOnlyNotice() {
    const isSystemAdmin = useSelector((state: GlobalState) =>
        haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
    );

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
            message={isSystemAdmin ? (
                <FormattedMessage
                    id='channel_settings.read_only.system_admin_message'
                    defaultMessage="An access policy prevents changes to this channel from here. You can still edit this channel's access rules in the System Console."
                />
            ) : (
                <FormattedMessage
                    id='channel_settings.read_only.message'
                    defaultMessage='An access policy prevents you from making changes in this channel. These settings are shown for reference only.'
                />
            )}
        />
    );
}
