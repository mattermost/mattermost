// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useSelector} from 'react-redux';

import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import Markdown from 'components/markdown';

import {getPluginPreferenceKey} from 'utils/plugins/preferences';

import type {PluginConfigurationSetting} from 'types/plugins/user_settings';
import type {GlobalState} from 'types/store';

import RadioOption from './radio_option';

type Props = {
    setting: PluginConfigurationSetting;
    pluginId: string;
    informChange: (name: string, value: string) => void;
}

const RadioInput = ({
    setting,
    pluginId,
    informChange,
}: Props) => {
    const preference = useSelector<GlobalState, string>((state: GlobalState) => getPreference(state, getPluginPreferenceKey(pluginId), setting.name, setting.default));
    const [selectedValue, setSelectedValue] = useState(preference);

    const onSelected = useCallback((value: string) => {
        setSelectedValue(value);
        informChange(setting.name, value);
    }, [setting.name]);

    return (
        <fieldset key={setting.name}>
            <legend className='form-legend hidden-label'>
                {setting.title || setting.name}
            </legend>
            {setting.options.map((option) => (
                <RadioOption
                    key={option.value}
                    name={setting.name}
                    option={option}
                    selectedValue={selectedValue}
                    onSelected={onSelected}
                />
            ))}
            {setting.helpText && (
                <div className='mt-5'>
                    <Markdown
                        message={setting.helpText}
                        options={{mentionHighlight: false}}
                    />
                </div>
            )}
        </fieldset>
    );
};

export default RadioInput;
