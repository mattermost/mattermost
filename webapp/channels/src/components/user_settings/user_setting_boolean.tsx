// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useUserSetting} from './user_setting';
import {useRadioSetting, type UseRadioSettingOptions, type UserSettingRadioProps} from './user_setting_radio';

const options = [
    'true',
    'false',
];

export interface UseBooleanSettingOptions extends Omit<UseRadioSettingOptions, 'options' | 'renderOptionLabel'> {

    /**
     * A callback that renders the label for the given option. Defaults to rendering "Off" for "false" and "On" for
     * anything else.
     */
    renderOptionLabel?: UseRadioSettingOptions['renderOptionLabel'];
}

export function useBooleanSetting({
    helpText,
    renderOptionLabel = renderOnOffLabel,
}: UseBooleanSettingOptions) {
    return useRadioSetting({
        helpText,
        options,
        renderOptionLabel,
    });
}

export interface UserSettingBooleanProps extends Omit<UserSettingRadioProps, 'options' | 'renderOptionLabel'>, UseBooleanSettingOptions {}

export function UserSettingBoolean({helpText, renderOptionLabel, ...otherProps}: UserSettingBooleanProps) {
    const {component} = useUserSetting({
        ...otherProps,
        ...useBooleanSetting({helpText, renderOptionLabel}),
    });

    return component;
}

function renderOnOffLabel(value: string) {
    if (value === 'false') {
        return (
            <FormattedMessage
                id='user.settings.advance.off'
                defaultMessage='Off'
            />
        );
    }

    return (
        <FormattedMessage
            id='user.settings.advance.on'
            defaultMessage='On'
        />
    );
}
