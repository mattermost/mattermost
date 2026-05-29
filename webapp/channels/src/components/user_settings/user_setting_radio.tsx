// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import {a11yFocus} from 'utils/utils';

import {useUserSetting, type InputRenderProps, type UseUserSettingOptions} from './user_setting';

export interface UseRadioSettingOptions {

    /**
     * The values of the options
     */
    options: string[];

    /**
     * A callback that renders the label for the given option
     */
    renderOptionLabel: (option: string) => React.ReactNode;
}

export function useRadioSetting({
    options,
    renderOptionLabel,
}: UseRadioSettingOptions) {
    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // The browser already moves the focus, but this is needed to ensure that the A11yController shows a visible
        // focus highlight when using the keyboard.
        a11yFocus(e.currentTarget);

        return e.currentTarget.value;
    }, []);

    const renderInputs = useCallback(({onChange, sectionId, value}: InputRenderProps<string>) => {
        return (
            <div role='radiogroup'>
                {options.map((option) => (
                    <div
                        key={option}
                        className='radio'
                    >
                        <label>
                            <input
                                id={`${sectionId}${option}`}
                                type='radio'
                                value={option}
                                name={sectionId}
                                checked={value === option}
                                onChange={onChange}
                            />
                            {renderOptionLabel(option)}
                        </label>
                    </div>
                ))}
            </div>
        );
    }, [options, renderOptionLabel]);

    return {
        onChange,
        renderInputs,
        renderMinDescription: renderOptionLabel,
    };
}

export interface UserSettingRadioProps extends Omit<UseUserSettingOptions<string>, 'onChange' | 'renderInputs' | 'renderMinDescription'>, UseRadioSettingOptions {}

export function UserSettingRadio({options, renderOptionLabel, ...otherProps}: UserSettingRadioProps) {
    const {component} = useUserSetting({
        ...otherProps,
        ...useRadioSetting({options, renderOptionLabel}),
    });

    return component;
}
