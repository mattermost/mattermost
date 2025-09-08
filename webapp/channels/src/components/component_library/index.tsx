// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {applyTheme} from 'utils/utils';
import DropdownInput from 'components/dropdown_input';

import ButtonComponentLibrary from './button.cl';
import SectionNoticeComponentLibrary from './section_notice.cl';

import './component_library.scss';

const componentMap = {
    'Button': ButtonComponentLibrary,
    'Section Notice': SectionNoticeComponentLibrary,
};

type ComponentName = keyof typeof componentMap
const defaultComponent = Object.keys(componentMap)[0] as ComponentName;

type ThemeName = keyof typeof Preferences.THEMES;
const defaultTheme = Object.keys(Preferences.THEMES)[0] as ThemeName;

// localStorage keys
const STORAGE_KEYS = {
    SELECTED_COMPONENT: 'componentLibrary_selectedComponent',
    SELECTED_THEME: 'componentLibrary_selectedTheme',
} as const;

// Helper function to format theme names consistently
const formatThemeLabel = (theme: string) => theme.charAt(0).toUpperCase() + theme.slice(1);

// Safe localStorage utilities
const getStoredValue = <T,>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
        console.warn(`Failed to get stored value for key "${key}":`, error);
        return defaultValue;
    }
};

const setStoredValue = <T,>(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Failed to set stored value for key "${key}":`, error);
    }
};

const ComponentLibrary = () => {
    const [selectedComponent, setSelectedComponent] = useState<ComponentName>(() => 
        getStoredValue(STORAGE_KEYS.SELECTED_COMPONENT, defaultComponent)
    );
    const onSelectComponent = useCallback((option: any) => {
        const newValue = option.value as ComponentName;
        setSelectedComponent(newValue);
        setStoredValue(STORAGE_KEYS.SELECTED_COMPONENT, newValue);
    }, []);

    const [selectedTheme, setSelectedTheme] = useState<ThemeName>(() => 
        getStoredValue(STORAGE_KEYS.SELECTED_THEME, defaultTheme)
    );
    const onSelectTheme = useCallback((option: any) => {
        const newValue = option.value as ThemeName;
        setSelectedTheme(newValue);
        setStoredValue(STORAGE_KEYS.SELECTED_THEME, newValue);
    }, []);

    useEffect(() => {
        applyTheme(Preferences.THEMES[selectedTheme]);
    }, [selectedTheme]);

    const componentOptions = useMemo(() => {
        return Object.keys(componentMap).map((v) => ({
            label: v,
            value: v,
        }));
    }, []);

    const themeOptions = useMemo(() => {
        return Object.keys(Preferences.THEMES).map((v) => ({
            label: formatThemeLabel(v),
            value: v,
        }));
    }, []);

    const SelectedComponent = componentMap[selectedComponent];
    return (
        <div className={'clWrapper'}>
            <div className={'clTopInputs'}>
                <div className={'clInputWrapper'}>
                    <DropdownInput
                        className='component-selector-dropdown'
                        name='component'
                        placeholder='Component'
                        value={componentOptions.find(option => option.value === selectedComponent)}
                        options={componentOptions}
                        onChange={onSelectComponent}
                    />
                </div>
                <div className={'clInputWrapper'}>
                    <DropdownInput
                        className='theme-selector-dropdown'
                        name='theme'
                        placeholder='Theme'
                        value={themeOptions.find(option => option.value === selectedTheme)}
                        options={themeOptions}
                        onChange={onSelectTheme}
                    />
                </div>
            </div>
            <div className={'clComponentWrapper'}>
                <SelectedComponent
                    backgroundClass="clCenterBackground"
                />
            </div>
        </div>
    );
};

export default ComponentLibrary;
