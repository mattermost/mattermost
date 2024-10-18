// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {applyTheme} from 'utils/utils';

import SectionNoticeComponentLibrary from './section_notice.cl';

import './component_library.scss';

const componentMap = {
    'Section Notice': SectionNoticeComponentLibrary,
};

type ComponentName = keyof typeof componentMap
const defaultComponent = Object.keys(componentMap)[0] as ComponentName;

type ThemeName = keyof typeof Preferences.THEMES;
const defaultTheme = Object.keys(Preferences.THEMES)[0] as ThemeName;

const ComponentLibrary = () => {
    const [selectedComponent, setSelectedComponent] = useState<ComponentName>(defaultComponent);
    const onSelectComponent = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedComponent(e.target.value as ComponentName);
    }, []);

    const [selectedTheme, setSelectedTheme] = useState(defaultTheme);
    const onSelectTheme = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedTheme(e.target.value as ThemeName);
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
            <div className={'clInput'}>
                {'Component: '}
                <select
                    onChange={onSelectComponent}
                    value={selectedComponent}
                >
                    {componentOptions}
                </select>
            </div>
            <div className={'clInput'}>
                {'Theme: '}
                <select
                    onChange={onSelectTheme}
                    value={selectedTheme}
                >
                    {themeOptions}
                </select>
            </div>
            <div className={'clWrapper'}>
                <SelectedComponent/>
            </div>
        </div>
    );
};

export default ComponentLibrary;
