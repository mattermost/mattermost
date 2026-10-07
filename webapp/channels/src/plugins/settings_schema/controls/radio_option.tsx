// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import {Radio} from '@mattermost/compass-ui/components/radio';

import Markdown from 'components/markdown';

import type {RadioSettingOption} from '../types';

type Props = {
    name: string;
    option: RadioSettingOption;
    selectedValue: string;
    onSelected: (value: string) => void;
};

const markdownOptions = {mentionHighlight: false};

const RadioOption = ({
    name,
    option,
    selectedValue,
    onSelected,
}: Props) => {
    const onChange = useCallback(() => onSelected(option.value), [onSelected, option.value]);

    return (
        <div className='radio'>
            <Radio
                name={name}
                value={option.value}
                checked={selectedValue === option.value}
                onChange={onChange}
            >
                {option.text}
            </Radio>
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
