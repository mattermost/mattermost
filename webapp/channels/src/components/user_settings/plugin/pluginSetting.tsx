// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

import type {GlobalState} from 'types/store';

import RadioInput from './radio';
import type {PluginConfigurationSetting} from './types';

type Props = {
    pluginId: string;
    updateSection: (section: string) => void;
    activeSection: string;
    setting: PluginConfigurationSetting;
}

const PluginSetting = ({
    pluginId,
    setting,
    activeSection,
    updateSection,
}: Props) => {
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const preference = useSelector<GlobalState, string>((state: GlobalState) => getPreference(state, `pp_${pluginId}`, setting.name, setting.default));
    const [selectedValue, setSelectedValue] = useState(preference);

    const minDescribe = useMemo(() => {
        if (setting.type === 'radio') {
            return setting.options.find((v) => v.value === preference)?.text;
        }

        return undefined;
    }, [setting, preference]);

    const handleMinUpdateSection = (section: string): void => {
        updateSection(section);
    };

    const updateSetting = async (value: string) => {
        // Save preferences does not offer any await strategy or error handling
        // so I am leaving this as is for now. We probably should update save
        // preferences and handle any kind of error or network delay here.
        dispatch(savePreferences(userId, [{
            user_id: userId,
            category: `pp_${pluginId}`.slice(0, 32),
            name: setting.name,
            value,
        }]));
        setting.onSubmit?.(setting.name, value);
        updateSection('');
    };

    const inputs = [];
    if (setting.type === 'radio') {
        inputs.push(
            <RadioInput
                setting={setting}
                selectedValue={selectedValue}
                setSelectedValue={setSelectedValue}
            />);
    } else {
        return null;
    }

    if (setting.name === activeSection) {
        return (
            <SettingItemMax
                title={setting.title}
                inputs={inputs}
                submit={() => updateSetting(selectedValue)}
                updateSection={updateSection}

            />
        );
    }

    return (
        <SettingItemMin
            section={setting.name}
            title={setting.title}
            updateSection={handleMinUpdateSection}
            describe={minDescribe}
        />
    );
};

export default PluginSetting;
