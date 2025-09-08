// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {applyTheme} from 'utils/utils';

import ButtonComponentLibrary from './button.cl';
import SectionNoticeComponentLibrary from './section_notice.cl';

import './component_library.scss';
import { ChevronDownIcon } from '@mattermost/compass-icons/components';

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
    const onSelectComponent = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value as ComponentName;
        setSelectedComponent(newValue);
        setStoredValue(STORAGE_KEYS.SELECTED_COMPONENT, newValue);
    }, []);

    const [selectedTheme, setSelectedTheme] = useState<ThemeName>(() => 
        getStoredValue(STORAGE_KEYS.SELECTED_THEME, defaultTheme)
    );
    const onSelectTheme = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value as ThemeName;
        setSelectedTheme(newValue);
        setStoredValue(STORAGE_KEYS.SELECTED_THEME, newValue);
    }, []);

    useEffect(() => {
        applyTheme(Preferences.THEMES[selectedTheme]);
    }, [selectedTheme]);

    const componentOptions = useMemo(() => {
        return Object.keys(componentMap).map((v) => (
            <option
                key={v}
                value={v}
            >
                {v}
            </option>
        ));
    }, []);

    const themeOptions = useMemo(() => {
        return Object.keys(Preferences.THEMES).map((v) => (
            <option
                key={v}
                value={v}
            >
                {v}
            </option>
        ));
    }, []);

    const SelectedComponent = componentMap[selectedComponent];
    return (
        <div className={'clWrapper'}>
            <div className={'clTopInputs'}>
                <div className={'clInputWrapper'}>
                    <label 
                        className={'clInputLabel'}
                        htmlFor={'clComponentSelector'}
                    >
                        {'Component: '}
                    </label>
                    <select
                        onChange={onSelectComponent}
                        value={selectedComponent}
                        id={'clComponentSelector'}
                    >
                        <button>
                            {selectedComponent}
                            <span className="picker-icon"><ChevronDownIcon /></span>
                        </button>
                        {componentOptions}
                    </select>
                </div>
                <div className={'clInputWrapper'}>
                    <label 
                        className={'clInputLabel'}
                        htmlFor={'clThemeSelector'}
                    >
                        {'Theme: '}
                    </label>
                    <select
                        onChange={onSelectTheme}
                        value={selectedTheme}
                        id={'clThemeSelector'}
                    >
                        <button>
                            {selectedTheme}
                            <span className="picker-icon"><ChevronDownIcon /></span>
                        </button>
                        {themeOptions}
                    </select>
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
