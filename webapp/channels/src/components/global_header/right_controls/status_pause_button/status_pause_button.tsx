// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import IconButton from 'components/global_header/header_icon_button';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

const StatusPauseButton: React.FC = () => {
    const dispatch = useDispatch();
    const config = useSelector((state: GlobalState) => getConfig(state));
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const isPaused = useSelector((state: GlobalState) =>
        get(state, 'mattermost_extended', 'status_paused', 'false'),
    ) === 'true';

    // Check if current user is in the allowed list
    const allowedUsers = (config?.MattermostExtendedStatusesStatusPauseAllowedUsers || '').split(',').map((u: string) => u.trim());
    const isAllowed = currentUser && allowedUsers.includes(currentUser.username);

    const handleToggle = useCallback(() => {
        if (!currentUser) {
            return;
        }
        dispatch(savePreferences(currentUser.id, [{
            user_id: currentUser.id,
            category: 'mattermost_extended',
            name: 'status_paused',
            value: isPaused ? 'false' : 'true',
        }]));
    }, [dispatch, currentUser, isPaused]);

    if (!isAllowed) {
        return null;
    }

    const tooltipText = isPaused ? (
        <FormattedMessage
            id='status_pause.resume'
            defaultMessage='Resume Status Tracking'
        />
    ) : (
        <FormattedMessage
            id='status_pause.pause'
            defaultMessage='Pause Status Tracking'
        />
    );

    return (
        <WithTooltip title={tooltipText}>
            <IconButton
                icon={isPaused ? 'play' : 'pause'}
                onClick={handleToggle}
                active={isPaused}
                aria-label={isPaused ? 'Resume Status Tracking' : 'Pause Status Tracking'}
            />
        </WithTooltip>
    );
};

export default StatusPauseButton;
