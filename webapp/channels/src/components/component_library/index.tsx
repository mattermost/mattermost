// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
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

type BackgroundType = 'center' | 'sidebar';

const ComponentLibrary = () => {
    const [selectedComponent, setSelectedComponent] = useState<ComponentName>(defaultComponent);
    const onSelectComponent = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedComponent(e.target.value as ComponentName);
    }, []);

    const [selectedTheme, setSelectedTheme] = useState(defaultTheme);
    const onSelectTheme = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedTheme(e.target.value as ThemeName);
    }, []);

    const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('center');
    const onSelectBackground = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedBackground(e.currentTarget.value as BackgroundType);
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
                <div className={'clInputWrapper'}>
                    <label className={'clInputLabel'}>
                        {'Background: '}
                        </label>
                        <div className={'clInputWrapper clRadioWrapper'}>
                            <input
                                onChange={onSelectBackground}
                                name={'background'}
                                value={'center'}
                                type={'radio'}
                                checked={selectedBackground === 'center'}
                                id={'clBackgroundCenterSelector'}
                            />
                            <label htmlFor={'clBackgroundCenterSelector'}>
                                {'Center channel'}
                            </label>
                        </div>
                        
                        <div className={'clInputWrapper clRadioWrapper'}>
                            <input
                                onChange={onSelectBackground}
                                name={'background'}
                                value={'sidebar'}
                                type={'radio'}
                                checked={selectedBackground === 'sidebar'}
                                id={'clBackgroundSidebarSelector'}
                            />
                            <label htmlFor={'clBackgroundSidebarSelector'}>
                                {'Sidebar'}
                            </label>
                        </div>
                        
                        
                    
                </div>
            </div>
            <div className={'clComponentWrapper'}>
                <SelectedComponent
                    backgroundClass={classNames({
                        clCenterBackground: selectedBackground === 'center',
                        clSidebarBackground: selectedBackground === 'sidebar',
                    })}
                />
            </div>
        </div>
    );
};

export default ComponentLibrary;
