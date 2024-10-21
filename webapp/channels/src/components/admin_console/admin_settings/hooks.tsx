// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {patchConfig} from 'mattermost-redux/actions/admin';
import {getEnvironmentConfig} from 'mattermost-redux/selectors/entities/admin';

import {setNavigationBlocked} from 'actions/admin_actions';

import type {GlobalState} from 'types/store';

import type {GetConfigFromStateFunction, GetStateFromConfigFunction, HandleSaveFunction} from './types';
import {isSetByEnv} from './utils';

export function useIsSetByEnv(path: string) {
    return useSelector((state: GlobalState) => isSetByEnv(getEnvironmentConfig(state), path));
}

export const useAdminSettingState = (
    getConfigFromState: GetConfigFromStateFunction,
    getStateFromConfig: GetStateFromConfigFunction,
    handleSaved?: HandleSaveFunction,
) => {
    const dispatch = useDispatch();
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState(undefined);
    const [settingValues, setSettingValues] = useState<{[x: string]: any}>({});

    const handleChange = useCallback((id: string, value: unknown) => {
        setSaveNeeded(true);
        setSettingValues((prev) => ({
            ...prev,
            [id]: value,
        }));
        dispatch(setNavigationBlocked(true));
    }, [dispatch]);

    const doSubmit = useCallback(async (callback?: () => void) => {
        setSaving(true);
        setServerError(undefined);

        const config = getConfigFromState(settingValues);

        const {data, error} = await dispatch(patchConfig(config));

        if (data) {
            setSettingValues((getStateFromConfig(data)));
            setSaveNeeded(false);
            setSaving(false);

            dispatch(setNavigationBlocked(false));
            callback?.();
            handleSaved?.(config, handleChange);
        } else if (error) {
            setSaving(false);
            setServerError(error.message);

            // setServerErrorId(error.server_error_id);
            callback?.();
            handleSaved?.(config, handleChange);
        }
    }, [dispatch, getConfigFromState, getStateFromConfig, handleChange, handleSaved, settingValues]);

    return {handleChange, doSubmit, saveNeeded, saving, serverError, settingValues};
};
