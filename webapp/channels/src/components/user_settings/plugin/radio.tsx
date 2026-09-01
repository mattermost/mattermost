// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useSelector} from 'react-redux';

import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import Radio from 'plugins/settings_schema/controls/radio';
import {getPluginPreferenceKey} from 'utils/plugins/preferences';

import type {PluginConfigurationRadioSetting} from 'types/plugins/user_settings';
import type {GlobalState} from 'types/store';

type Props = {
    setting: PluginConfigurationRadioSetting;
    pluginId: string;
    informChange: (name: string, value: string) => void;
};

// Binds the controlled shared Radio control to user preferences.
const RadioInput = ({
    setting,
    pluginId,
    informChange,
}: Props) => {
    const preference = useSelector<GlobalState, string>((state: GlobalState) => getPreference(state, getPluginPreferenceKey(pluginId), setting.name, setting.default));
    const [value, setValue] = useState(preference);

    const onChange = useCallback((newValue: string) => {
        setValue(newValue);
        informChange(setting.name, newValue);
    }, [informChange, setting.name]);

    return (
        <Radio
            setting={setting}
            value={value}
            onChange={onChange}
        />
    );
};

export default RadioInput;
