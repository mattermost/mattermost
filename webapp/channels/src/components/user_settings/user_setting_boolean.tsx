// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {a11yFocus} from 'utils/utils';

import {useUserSetting, type InputRenderProps} from './user_setting';

const options = ['false', 'true'];

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
     * A callback that renders the label for the given option. Defaults to rendering "Off" for "false" and "On" for
     * anything else.
     */
    renderOptionLabel?: (option: string) => React.ReactNode;

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
    renderOptionLabel = renderOnOffLabel,
    updateSection,
    title,
}: UseBooleanSettingOptions) {
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
    }, [renderOptionLabel]);

    const {component} = useUserSetting({
        activeSection,
        currentValue,
        helpText,
        onChange: handleChange,
        onSubmit,
        updateSection,
        renderMinDescription: renderOptionLabel,
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
