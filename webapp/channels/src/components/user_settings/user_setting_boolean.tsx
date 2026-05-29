// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {a11yFocus} from 'utils/utils';

import {useUserSetting, type InputRenderProps} from './user_setting';

export interface UseBooleanSettingOptions {

    /**
     * The ID of the active section
     */
    activeSection: string;

    /**
     * The current, saved value of the setting.
     */
    currentValue: string;

    /**
     * One or more FormattedMessages containing the help text for the setting. Each message will be rendered
     * as an individual paragraph.
     */
    helpText: React.ReactNode;

    /**
     * A callback to save the setting
     */
    onSubmit?: ((value: string) => void) | ((value: string) => Promise<void>);

    /**
     * The label for the setting in the UI
     */
    title: React.ReactNode;

    /**
     * A callback that changes the active section
     */
    updateSection: (section: string) => void;
}

export function useBooleanSetting({
    activeSection,
    currentValue,
    helpText,
    onSubmit,
    updateSection,
    title,
}: UseBooleanSettingOptions) {
    const {component} = useUserSetting({
        activeSection,
        currentValue,
        helpText,
        onChange: handleChange,
        onSubmit,
        updateSection,
        renderMinDescription: renderOnOffLabel,
        renderInputs,
        title,
    });

    return {component};
}

export function UserSettingBoolean(props: UseBooleanSettingOptions) {
    const {component} = useBooleanSetting(props);

    return component;
}

function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // The browser already moves the focus, but this is needed to ensure that the A11yController shows a visible
    // focus highlight when using the keyboard.
    a11yFocus(e.currentTarget);

    return e.currentTarget.value;
}

function renderInputs({onChange, sectionId, value}: InputRenderProps<string>) {
    return (
        <div role='radiogroup'>
            <div className='radio'>
                <label>
                    <input
                        id={`${sectionId}On`}
                        type='radio'
                        value='true'
                        name={sectionId}
                        checked={value === 'true'}
                        onChange={onChange}
                    />
                    {renderOnOffLabel('true')}
                </label>
            </div>
            <div className='radio'>
                <label>
                    <input
                        id={`${sectionId}Off`}
                        type='radio'
                        value='false'
                        name={sectionId}
                        checked={value === 'false'}
                        onChange={onChange}
                    />
                    {renderOnOffLabel('false')}
                </label>
            </div>
        </div>
    );
}

/**
 * Renders Off when value is the string "false". Renders On otherwise.
 */
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
