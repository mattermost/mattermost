// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';
import {getPluginPreferenceKey} from 'utils/plugins/preferences';

import type {PluginConfigurationSection} from 'types/plugins/user_settings';
import type {GlobalState} from 'types/store';

import RadioInput from './radio';

type Props = {
    pluginId: string;
    updateSection: (section: string) => void;
    activeSection: string;
    section: PluginConfigurationSection;
}

const PluginSetting = ({
    pluginId,
    section,
    activeSection,
    updateSection,
}: Props) => {
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const preferenceMin = useSelector<GlobalState, string>((state: GlobalState) => getPreference(state, getPluginPreferenceKey(pluginId), section.settings[0].name, section.settings[0].default));
    const toUpdate = useRef<{[name: string]: string}>({});

    const minDescribe = useMemo(() => {
        const setting = section.settings[0];
        if (setting.type === 'radio') {
            return setting.options.find((v) => v.value === preferenceMin)?.text;
        }

        return undefined;
    }, [section, preferenceMin]);

    const onSettingChanged = useCallback((name: string, value: string) => {
        toUpdate.current[name] = value;
    }, []);

    const updateSetting = useCallback(async () => {
        const preferences = [];
        for (const key of Object.keys(toUpdate.current)) {
            preferences.push({
                user_id: userId,
                category: getPluginPreferenceKey(pluginId),
                name: key,
                value: toUpdate.current[key],
            });
        }

        if (preferences.length) {
            // Save preferences does not offer any await strategy or error handling
            // so I am leaving this as is for now. We probably should update save
            // preferences and handle any kind of error or network delay here.
            dispatch(savePreferences(userId, preferences));
            section.onSubmit?.(toUpdate.current);
        }

        updateSection('');
    }, [pluginId, dispatch, section.onSubmit]);

    useEffect(() => {
        if (activeSection !== section.title) {
            toUpdate.current = {};
        }
    }, [activeSection, section.title]);

    const inputs = [];
    for (const setting of section.settings) {
        if (setting.type === 'radio') {
            inputs.push(
                <RadioInput
                    key={setting.name}
                    setting={setting}
                    informChange={onSettingChanged}
                    pluginId={pluginId}
                />);
        } else if (setting.type === 'custom') {
            const CustomComponent = setting.component;
            const inputEl = (
                <PluggableErrorBoundary
                    key={setting.name}
                    pluginId={pluginId}
                >
                    <CustomComponent informChange={onSettingChanged}/>
                </PluggableErrorBoundary>
            );
            inputs.push(inputEl);
        }
    }

    if (!inputs.length) {
        return null;
    }

    if (section.title === activeSection) {
        return (
            <SettingItemMax
                title={section.title}
                inputs={inputs}
                submit={updateSetting}
                updateSection={updateSection}
            />
        );
    }

    return (
        <SettingItemMin
            section={section.title}
            title={section.title}
            updateSection={updateSection}
            describe={minDescribe}
            isDisabled={section.disabled}
        />
    );
};

export default PluginSetting;
