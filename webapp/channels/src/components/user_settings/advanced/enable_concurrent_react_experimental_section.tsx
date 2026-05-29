// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import {UserSettingBoolean} from '../user_setting_boolean';

const storageKey = 'enable_concurrent_react_experimental';

type Props = {
    activeSection: string;
    adminMode?: boolean;
    updateSection: (section: string) => void;
};

export default function EnableConcurrentReactExperimentalSection({
    adminMode,
    ...otherProps
}: Props) {
    const currentValue = useLocalStorageItem(storageKey, 'false');

    const handleSubmit = useCallback((value: string) => {
        return new Promise<void>((resolve) => {
            localStorage.setItem(storageKey, value);

            // Manually dispatch an event to update currentvalue because storage events are only fired for other tabs
            requestAnimationFrame(() => {
                window.dispatchEvent(new StorageEvent('storage', {
                    key: storageKey,
                    newValue: value,
                    storageArea: localStorage,
                }));

                resolve();
            });
        });
    }, []);

    const enableDeveloperMode = useSelector((state: GlobalState) => getConfig(state).EnableDeveloper === 'true');

    if (adminMode || !enableDeveloperMode) {
        return null;
    }

    return (
        <UserSettingBoolean
            currentValue={currentValue}
            helpText={[
                <FormattedMessage
                    key={1}
                    id='user.settings.advance.concurrentReactExperimentalDesc1'
                    defaultMessage={'When "On", enable concurrent React support for development. This is known to cause issues and should only be done if you know what you\'re doing.'}
                />,
                <FormattedMessage
                    key={2}
                    id='user.settings.advance.concurrentReactExperimentalDesc2'
                    defaultMessage={'You may need to refresh the page before this setting takes effect.'}
                />,
            ]}
            onSubmit={handleSubmit}
            title={
                <FormattedMessage
                    id='user.settings.advance.concurrentReactExperimental'
                    defaultMessage='Enable Concurrent React (Experimental)'
                />
            }
            {...otherProps}
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
