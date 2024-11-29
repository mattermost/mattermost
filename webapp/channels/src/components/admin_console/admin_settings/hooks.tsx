// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {AdminConfig} from '@mattermost/types/config';

import {patchConfig} from 'mattermost-redux/actions/admin';
import {getConfig, getEnvironmentConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions';

import type {GlobalState} from 'types/store';

import type {GetConfigFromStateFunction, GetStateFromConfigFunction, HandleSaveFunction} from './types';
import {isSetByEnv} from './utils';

export function useIsSetByEnv(path: string) {
    return useSelector((state: GlobalState) => isSetByEnv(getEnvironmentConfig(state), path));
}

export const useAdminSettingState = <T extends Record<string, any>>(
    getConfigFromState: GetConfigFromStateFunction<T>,
    getStateFromConfig: GetStateFromConfigFunction<T>,
    preSave?: (values: T) => Promise<string>,
    handleSaved?: HandleSaveFunction,
) => {
    const dispatch = useDispatch();

    const license = useSelector(getLicense);
    const config = useSelector(getConfig) as AdminConfig;

    const [saveNeeded, setSaveNeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | undefined>(undefined);
    const [settingValues, setSettingValues] = useState<T>(() => getStateFromConfig(config, license));

    const handleChange = useCallback((id: string, value: unknown) => {
        setSaveNeeded(true);
        setSettingValues((prev) => ({
            ...prev,
            [id]: value,
        }));
        dispatch(setNavigationBlocked(true));
    }, [dispatch]);

    const doSubmit = useCallback(async () => {
        setSaving(true);
        setServerError(undefined);

        const configToPatch = getConfigFromState(settingValues);

        if (preSave) {
            const preSaveError = await preSave(settingValues);
            if (preSaveError) {
                setSaving(false);
                setServerError(preSaveError);
                handleSaved?.(configToPatch, handleChange);
            }
        }

        const {data, error} = await dispatch(patchConfig(configToPatch));

        if (data) {
            setSettingValues(getStateFromConfig(data, license));
            setSaveNeeded(false);
            setSaving(false);

            dispatch(setNavigationBlocked(false));
            handleSaved?.(configToPatch, handleChange);
        } else if (error) {
            setSaving(false);
            setServerError(error.message);

            handleSaved?.(configToPatch, handleChange);
        }
    }, [dispatch, getConfigFromState, getStateFromConfig, handleChange, handleSaved, license, preSave, settingValues]);

    return {handleChange, doSubmit, saveNeeded, saving, serverError, settingValues};
};
