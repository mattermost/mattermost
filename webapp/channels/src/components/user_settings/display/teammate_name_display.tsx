// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants';

import {useUserSetting, type InputRenderProps} from '../user_setting';
import {useRadioSetting, type UserSettingRadioProps} from '../user_setting_radio';

const teammateNameDisplayOptions = [
    Constants.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
    Constants.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
    Constants.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
];

export interface TeammateNameDisplayProps extends Pick<UserSettingRadioProps, 'activeSection' | 'currentValue' | 'onSubmit' | 'updateSection'> {
    lockTeammateNameDisplay: boolean;
}

export default function TeammateNameDisplay({lockTeammateNameDisplay, ...otherProps}: TeammateNameDisplayProps) {
    const {renderInputs: renderRadioInputs, ...radioProps} = useRadioSetting({
        helpText: lockTeammateNameDisplay ? undefined : (
            <FormattedMessage
                id='user.settings.display.teammateNameDisplayDescription'
                defaultMessage={'Set how to display other user\'s names in posts and the Direct Messages list.'}
            />
        ),
        options: teammateNameDisplayOptions,
        renderOptionLabel: renderTeammateNameDisplayLabel,
    });

    const renderInputs = useCallback((inputProps: InputRenderProps<string>) => {
        if (lockTeammateNameDisplay) {
            return (
                <FormattedMessage
                    id='user.settings.display.teammateNameDisplay'
                    defaultMessage='This field is handled through your System Administrator. If you want to change it, you need to do so through your System Administrator.'
                    tagName='p'
                />
            );
        }

        return renderRadioInputs(inputProps);
    }, [lockTeammateNameDisplay, renderRadioInputs]);

    const {component} = useUserSetting({
        ...otherProps,
        ...radioProps,
        hideSubmit: lockTeammateNameDisplay,
        renderInputs,
        title: (
            <FormattedMessage
                id='user.settings.display.teammateNameDisplayTitle'
                defaultMessage='Teammate Name Display'
            />
        ),
    });

    return component;
}

function renderTeammateNameDisplayLabel(value: string) {
    if (value === Constants.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME) {
        return (
            <FormattedMessage
                id='user.settings.display.teammateNameDisplayUsername'
                defaultMessage='Show username'
            />
        );
    }

    if (value === Constants.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME) {
        return (
            <FormattedMessage
                id='user.settings.display.teammateNameDisplayNicknameFullname'
                defaultMessage='Show nickname if one exists, otherwise show first and last name'
            />
        );
    }

    return (
        <FormattedMessage
            id='user.settings.display.teammateNameDisplayFullname'
            defaultMessage='Show first and last name'
        />
    );
}
