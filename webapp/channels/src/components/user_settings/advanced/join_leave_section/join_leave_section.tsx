// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'mattermost-redux/constants';

import {UserSettingBoolean} from '../..//user_setting_boolean';

import type {OwnProps} from './index';

type Props = OwnProps & {
    activeSection: string;
    joinLeave: string;
    updateSection: (section: string) => void;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
};

export default function JoinLeaveSection({
    actions,
    activeSection,
    joinLeave,
    updateSection,
    userId,
}: Props) {
    const handleSubmit = useCallback((value: string) => {
        return actions.savePreferences(userId, [{
            user_id: userId,
            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
            value,
        }]);
    }, [actions, userId]);

    return (
        <UserSettingBoolean
            activeSection={activeSection}
            currentValue={joinLeave}
            helpText={
                <FormattedMessage
                    id='user.settings.advance.joinLeaveDesc'
                    defaultMessage='When "On", System Messages saying a user has joined or left a channel will be visible. When "Off", the System Messages about joining or leaving a channel will be hidden. A message will still show up when you are added to a channel, so you can receive a notification.'
                />
            }
            onSubmit={handleSubmit}
            title={
                <FormattedMessage
                    id='user.settings.advance.joinLeaveTitle'
                    defaultMessage='Enable Join/Leave Messages'
                />
            }
            updateSection={updateSection}
        />
    );
}
