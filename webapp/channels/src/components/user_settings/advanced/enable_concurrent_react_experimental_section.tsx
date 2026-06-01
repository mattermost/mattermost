// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

import {a11yFocus} from 'utils/utils';

import type {GlobalState} from 'types/store';

const section = 'concurrentReactExperimental';

const storageKey = 'enable_concurrent_react_experimental';

type Props = {
    activeSection: string;
    adminMode?: boolean;
    onUpdateSection: (section?: string) => void;
    renderOnOffLabel: (enabled: string) => React.JSX.Element;
};

export default function EnableConcurrentReactExperimentalSection({
    activeSection,
    adminMode,
    onUpdateSection,
    renderOnOffLabel,
}: Props) {
    const enableDeveloperMode = useSelector((state: GlobalState) => getConfig(state).EnableDeveloper === 'true');

    const currentValue = useLocalStorageItem(storageKey, 'false');
    const [enabled, setEnabled] = useState(currentValue);

    const active = activeSection === section;
    const [prevActive, setPrevActive] = useState(active);
    if (active !== prevActive) {
        setPrevActive(active);
        setEnabled(currentValue);
    }

    const minRef = React.createRef<SettingItemMin>();
    useDidUpdate(() => {
        if (!active) {
            minRef.current?.focus();
        }
    }, [active]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEnabled(e.currentTarget.value);

        a11yFocus(e.currentTarget);
    }, []);

    const handleSubmit = useCallback(() => {
        localStorage.setItem(storageKey, enabled);

        // Manually dispatch an event to update currentvalue because storage events are only fired for other tabs
        requestAnimationFrame(() => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: storageKey,
                newValue: enabled,
                storageArea: localStorage,
            }));

            onUpdateSection();
        });
    }, [enabled, onUpdateSection]);

    if (adminMode || !enableDeveloperMode) {
        return null;
    }

    if (!active) {
        return (
            <SettingItemMin
                ref={minRef}
                title={
                    <FormattedMessage
                        id='user.settings.advance.concurrentReactExperimental'
                        defaultMessage='Enable Concurrent React (Experimental)'
                    />
                }
                describe={renderOnOffLabel(currentValue)}
                section={section}
                updateSection={onUpdateSection}
            />
        );
    }

    return (
        <SettingItemMax
            title={
                <FormattedMessage
                    id='user.settings.advance.concurrentReactExperimental'
                    defaultMessage='Enable Concurrent React (Experimental)'
                />
            }
            inputs={[
                <fieldset key='joinLeaveSetting'>
                    <legend className='form-legend hidden-label'>
                        <FormattedMessage
                            id='user.settings.advance.concurrentReactExperimental'
                            defaultMessage='Enable Concurrent React (Experimental)'
                        />
                    </legend>
                    <div className='radio'>
                        <label>
                            <input
                                id='joinLeaveOn'
                                type='radio'
                                value={'true'}
                                name={section}
                                checked={enabled === 'true'}
                                onChange={handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.advance.on'
                                defaultMessage='On'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='joinLeaveOff'
                                type='radio'
                                value={'false'}
                                name={section}
                                checked={enabled === 'false'}
                                onChange={handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.advance.off'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='mt-5'>
                        <FormattedMessage
                            id='user.settings.advance.concurrentReactExperimentalDesc1'
                            defaultMessage={'When "On", enable concurrent React support for development. This is known to cause issues and should only be done if you know what you\'re doing.'}
                            tagName='p'
                        />
                        <FormattedMessage
                            id='user.settings.advance.concurrentReactExperimentalDesc2'
                            defaultMessage={'You may need to refresh the page before this setting takes effect.'}
                            tagName='p'
                        />
                    </div>
                </fieldset>,
            ]}
            submit={handleSubmit}
            saving={false}
            updateSection={onUpdateSection}
        />
    );
}

function useLocalStorageItem(key: string, defaultValue: string) {
    const [value, setValue] = useState(() => (localStorage.getItem(key) || defaultValue));

    useEffect(() => {
        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === key && e.storageArea === localStorage) {
                setValue(e.newValue || defaultValue);
            }
        };

        window.addEventListener('storage', handleStorageEvent);
        return () => {
            window.removeEventListener('storage', handleStorageEvent);
        };
    }, [key, defaultValue]);

    return value;
}
