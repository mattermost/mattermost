// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import Markdown from 'components/markdown';

import type {PluginConfigurationRadioSettingOption} from 'types/plugins/user_settings';

type Props = {
    selectedValue: string;
    name: string;
    option: PluginConfigurationRadioSettingOption;
    onSelected: (v: string) => void;
}

const markdownOptions = {mentionHighlight: false};

const RadioOption = ({
    selectedValue,
    name,
    option,
    onSelected,
}: Props) => {
    const onChange = useCallback(() => onSelected(option.value), [option.value]);
    return (
        <div className={'radio'}>
            <label >
                <input
                    type='radio'
                    name={name}
                    checked={selectedValue === option.value}
                    onChange={onChange}
                />
                {option.text}
            </label>
            <br/>
            {option.helpText && (
                <Markdown
                    message={option.helpText}
                    options={markdownOptions}
                />
            )}
        </div>
    );
};

export default RadioOption;
