// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useId, useRef, useState} from 'react';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

export interface UseUserSettingOptions<T> {

    /**
     * The ID of the active section.
     */
    activeSection: string;

    /**
     * The current, saved value of the setting.
     */
    currentValue: T;

    /**
     * One or more FormattedMessages containing the help text for the setting. Each message will be rendered
     * as an individual paragraph.
     */
    helpText: React.ReactNode;

    /**
     * Whether or not to hide the submit button.
     */
    hideSubmit?: boolean;

    /**
     * A callback that, given ChangeEvent, returns the updated value of the setting.
     */
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => T;

    /**
     * A callback to save the setting
     */
    onSubmit?: ((value: T) => void) | ((value: T) => Promise<void>);

    /**
     * A callback that renders the description of the setting's value when it is minimized.
     */
    renderMinDescription: (value: T) => React.ReactNode;

    /**
     * A callback that renders the actual inputs used to control the setting.
     */
    renderInputs: (renderProps: InputRenderProps<T>) => React.ReactNode;

    /**
     * The label for the setting in the UI
     */
    title: React.ReactNode;

    /**
     * A callback that changes the active section
     */
    updateSection: (section: string) => void;
}

export interface InputRenderProps<T> {
    sectionId: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    value: T;
}

export function useUserSetting<T>({
    activeSection,
    helpText,
    hideSubmit,
    currentValue,
    onChange,
    onSubmit,
    renderMinDescription,
    renderInputs,
    title,
    updateSection,
}: UseUserSettingOptions<T>) {
    const {active, sectionId} = useSettingSection(activeSection);
    const [value, setValue] = useSettingValue(active, currentValue);
    const minRef = useEditButtonFocus(sectionId, activeSection);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(onChange(e));
    }, [onChange, setValue]);

    const [saving, setSaving] = useState(false);
    const handleSubmit = useCallback(() => {
        setSaving(true);

        const result = onSubmit?.(value);

        // TODO this doesn't handle server errors or passing them back to SettingItemMax

        if (result && result instanceof Promise) {
            result.then(() => {
                setSaving(false);
                updateSection('');
            });
        } else {
            setSaving(false);
            updateSection('');
        }
    }, [value, onSubmit, updateSection]);

    let component;
    if (active) {
        component = (
            <SettingItemMax
                title={title}
                inputs={[
                    <fieldset key='setting'>
                        <legend className='form-legend hidden-label'>
                            {title}
                        </legend>
                        {renderInputs({onChange: handleChange, sectionId, value})}
                        {renderHelpText(helpText)}
                    </fieldset>,
                ]}
                submit={hideSubmit ? undefined : handleSubmit}
                saving={saving}
                updateSection={updateSection}
            />
        );
    } else {
        component = (
            <SettingItemMin
                ref={minRef}
                title={title}
                describe={renderMinDescription(value)}
                section={sectionId}
                updateSection={updateSection}
            />
        );
    }

    return {component};
}

/**
 * Returns the ID for the section and information about whether or not it's active.
 */
function useSettingSection(activeSection: string | undefined) {
    const sectionId = useId();

    const [prevActiveSection, setPrevActiveSection] = useState(activeSection);
    if (activeSection !== prevActiveSection) {
        setPrevActiveSection(activeSection);
    }

    return {
        active: sectionId === activeSection,
        areAllSectionsInactive: activeSection === '',
        sectionId,
    };
}

/**
 * Focuses the Edit button on a setting when that setting section is closed.
 */
function useEditButtonFocus(sectionId: string, activeSection: string | undefined) {
    const minRef = React.createRef<SettingItemMin>();

    const prevActiveSection = useRef(activeSection);
    useDidUpdate(() => {
        if (!activeSection && prevActiveSection.current === sectionId) {
            minRef.current?.focus();
        }

        prevActiveSection.current = activeSection;
    }, [activeSection]);

    return minRef;
}

/**
 * useSettingValue acts as a useState, but it resets the state value to currentValue whenever active changes.
 */
function useSettingValue<T>(active: boolean, currentValue: T) {
    const [value, setValue] = useState(currentValue);

    const [prevActive, setPrevActive] = useState(active);
    if (active !== prevActive) {
        setPrevActive(active);
        setValue(currentValue);
    }

    return [
        active ? value : currentValue,
        setValue,
    ] as const;
}

/**
 * Renders the help text for a setting wrapped in paragraph(s) and with a margin above. If helpText contains multiple
 * items, each is wrapped in its own paragraph.
 */
function renderHelpText(helpText: React.ReactNode) {
    if (!helpText) {
        return null;
    }

    let contents;
    if (Array.isArray(helpText)) {
        contents = helpText.map((item) => <p key={item?.props?.key}>{item}</p>);
    } else if (helpText) {
        contents = <p>{helpText}</p>;
    } else {
        contents = null;
    }

    return <div className='mt-5'>{contents}</div>;
}
