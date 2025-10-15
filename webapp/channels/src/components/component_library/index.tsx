// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import DropdownInput from 'components/dropdown_input';

import {applyTheme} from 'utils/utils';

import ButtonComponentLibrary from './button.cl';
import IconButtonComponentLibrary from './icon_button.cl';
import SectionNoticeComponentLibrary from './section_notice.cl';

import './component_library.scss';

const componentMap = {
    Button: ButtonComponentLibrary,
    'Icon Button': IconButtonComponentLibrary,
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
const getStoredValue = <T, >(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
        // Failed to get stored value, using default
        return defaultValue;
    }
};

const setStoredValue = <T, >(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Failed to set stored value
    }
};

const ComponentLibrary = () => {
    const [selectedComponent, setSelectedComponent] = useState<ComponentName>(() => {
        const stored = getStoredValue(STORAGE_KEYS.SELECTED_COMPONENT, defaultComponent);

        // Ensure the stored value is valid, otherwise use the first component
        return Object.keys(componentMap).includes(stored) ? stored as ComponentName : defaultComponent;
    });

    const [selectedTheme, setSelectedTheme] = useState<ThemeName>(() =>
        getStoredValue(STORAGE_KEYS.SELECTED_THEME, defaultTheme),
    );
    const onSelectTheme = useCallback((option: any) => {
        const newValue = option.value as ThemeName;
        setSelectedTheme(newValue);
        setStoredValue(STORAGE_KEYS.SELECTED_THEME, newValue);
    }, []);

    useEffect(() => {
        applyTheme(Preferences.THEMES[selectedTheme]);
    }, [selectedTheme]);

    const themeOptions = useMemo(() => {
        return Object.keys(Preferences.THEMES).map((v) => ({
            label: formatThemeLabel(v),
            value: v,
        }));
    }, []);

    // Ensure we always have a valid component, even if state is corrupted
    const validComponent = Object.keys(componentMap).includes(selectedComponent) ? selectedComponent : defaultComponent;
    const SelectedComponent = componentMap[validComponent];
    return (
        <div className={'cl cl--sidebar-layout'}>
            <div className={'cl__sidebar'}>
                <div className={'cl__sidebar-section'}>
                    <div className={'cl__theme-selector'}>
                        <DropdownInput
                            className='theme-selector-dropdown'
                            name='theme'
                            placeholder='Theme'
                            value={themeOptions.find((option) => option.value === selectedTheme)}
                            options={themeOptions}
                            onChange={onSelectTheme}
                        />
                    </div>
                </div>

                <div className={'cl__sidebar-section'}>
                    <h3 className={'cl__sidebar-title'}>{'Components'}</h3>
                    <nav className={'cl__component-nav'}>
                        {Object.keys(componentMap).map((componentName) => (
                            <button
                                key={componentName}
                                className={`cl__component-nav-item ${validComponent === componentName ? 'cl__component-nav-item--active' : ''}`}
                                onClick={() => {
                                    setSelectedComponent(componentName as ComponentName);
                                    setStoredValue(STORAGE_KEYS.SELECTED_COMPONENT, componentName as ComponentName);
                                }}
                            >
                                {componentName}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className={'cl__main-content'}>
                <div className={'cl__component-wrapper'}>
                    <SelectedComponent/>
                </div>
            </div>
        </div>
    );
};

export default ComponentLibrary;
