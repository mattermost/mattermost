// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Markdown from 'components/markdown';

import type {PluginConfigurationSetting} from 'types/plugins/user_settings';

type Props = {
    setting: PluginConfigurationSetting;
    selectedValue: string;
    setSelectedValue: React.Dispatch<React.SetStateAction<string>>;
}
const RadioInput = ({
    setting,
    selectedValue,
    setSelectedValue,
}: Props) => {
    return (
        <fieldset key={setting.name}>
            <legend className='form-legend hidden-label'>
                {setting.title}
            </legend>
            {setting.options.map((v) => (
                <div
                    className={'radio'}
                    key={v.value}
                >
                    <label >
                        <input
                            type='radio'
                            name={setting.name}
                            checked={selectedValue === v.value}
                            onChange={() => setSelectedValue(v.value)}
                        />
                        {v.text}
                    </label>
                    <br/>
                    {v.helpText && (
                        <Markdown
                            message={v.helpText}
                            options={{mentionHighlight: false}}
                        />
                    )}
                </div>
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
