// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import AdminSetting from 'components/admin_console/admin_settings/admin_settings';
import SettingsGroup from 'components/admin_console/settings_group';

import type {GlobalState} from 'types/store';

import AutomaticPrepackagedPlugins from './automatic_prepackaged_plugins';
import {FIELD_IDS} from './constants';
import EnableMarketplace from './enable_marketplace';
import EnablePluginsSetting from './enable_plugins_setting';
import EnableRemoteMarketplace from './enable_remote_marketplace';
import MarketplaceUrl from './marketplace_url';
import {messages} from './messages';
import OverwritePluginModal from './overwrite_plugin_modal';
import PluginUploads from './plugin_uploads';
import PluginsContainer from './plugins_container';
import RemovePluginModal from './remove_plugin_modal';
import RequirePluginSignature from './require_plugin_signature';

import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        PluginSettings: {
            Enable: state[FIELD_IDS.ENABLE],
            EnableUploads: state[FIELD_IDS.ENABLE_UPLOADS],
            AllowInsecureDownloadURL: state[FIELD_IDS.ALLOW_INSECURE_DOWNLOAD_URL],
            EnableMarketplace: state[FIELD_IDS.ENABLE_MARKETPLACE],
            EnableRemoteMarketplace: state[FIELD_IDS.ENABLE_REMOTE_MARKETPLACE],
            AutomaticPrepackagedPlugins: state[FIELD_IDS.AUTOMATIC_PREPACKAGED_PLUGINS],
            MarketplaceURL: state[FIELD_IDS.MARKETPLACE_URL],
            RequirePluginSignature: state[FIELD_IDS.REQUIRE_PLUGIN_SIGNATURE],
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.ENABLE]: config?.PluginSettings?.Enable,
        [FIELD_IDS.ENABLE_UPLOADS]: config?.PluginSettings?.EnableUploads,
        [FIELD_IDS.ALLOW_INSECURE_DOWNLOAD_URL]: config?.PluginSettings?.AllowInsecureDownloadURL,
        [FIELD_IDS.ENABLE_MARKETPLACE]: config?.PluginSettings?.EnableMarketplace,
        [FIELD_IDS.ENABLE_REMOTE_MARKETPLACE]: config?.PluginSettings?.EnableRemoteMarketplace,
        [FIELD_IDS.AUTOMATIC_PREPACKAGED_PLUGINS]: config?.PluginSettings?.AutomaticPrepackagedPlugins,
        [FIELD_IDS.MARKETPLACE_URL]: config?.PluginSettings?.MarketplaceURL,
        [FIELD_IDS.REQUIRE_PLUGIN_SIGNATURE]: config?.PluginSettings?.RequirePluginSignature,
    };
};

function renderTitle() {
    return (<FormattedMessage {...messages.title}/>);
}

type Props = {
    isDisabled?: boolean;
}

const PluginManagement = ({
    isDisabled,
}: Props) => {
    const dispatch = useDispatch();

    const restrictSystemAdmin = useSelector((state: GlobalState) => getConfig(state).ExperimentalSettings?.RestrictSystemAdmin);

    const [otherServerError, setOtherServerError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [overwriteModalProps, setOverwiteModalProps] = useState<PluginSettingsModalProps>();
    const [removeModalProps, setRemoveModalProps] = useState<PluginSettingsModalProps>();

    const confirmOverwrite = useCallback((onConfirm: () => void, onCancel: () => void) => {
        setOverwiteModalProps({
            show: true,
            onConfirm: () => {
                setOverwiteModalProps(undefined);
                onConfirm();
            },
            onCancel: () => {
                setOverwiteModalProps(undefined);
                onCancel();
            },
        });
    }, []);

    const confirmDelete = useCallback((onConfirm: () => void, onCancel: () => void) => {
        setRemoveModalProps({
            show: true,
            onConfirm: () => {
                setRemoveModalProps(undefined);
                onConfirm();
            },
            onCancel: () => {
                setRemoveModalProps(undefined);
                onCancel();
            },
        });
    }, []);

    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    const generalDisable = isDisabled || !settingValues[FIELD_IDS.ENABLE];
    const renderSettings = useCallback(() => {
        return (
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <SettingsGroup
                        id={'PluginSettings'}
                        container={false}
                    >
                        {!restrictSystemAdmin && (
                            <>
                                <EnablePluginsSetting
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.ENABLE]}
                                    isDisabled={isDisabled}
                                />
                                <RequirePluginSignature
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.REQUIRE_PLUGIN_SIGNATURE]}
                                    isDisabled={generalDisable}
                                />
                                <AutomaticPrepackagedPlugins
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.AUTOMATIC_PREPACKAGED_PLUGINS]}
                                    isDisabled={generalDisable}
                                />
                                <PluginUploads
                                    confirmOverwrite={confirmOverwrite}
                                    enableUploads={settingValues[FIELD_IDS.ENABLE_UPLOADS]}
                                    isDisabled={isDisabled}
                                    setLoading={setLoading}
                                    setServerError={setOtherServerError}
                                    serverError={otherServerError}
                                />
                                <EnableMarketplace
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.ENABLE_MARKETPLACE]}
                                    isDisabled={generalDisable}
                                />
                                <EnableRemoteMarketplace
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.ENABLE_REMOTE_MARKETPLACE]}
                                    isDisabled={generalDisable}
                                />
                                <MarketplaceUrl
                                    onChange={handleChange}
                                    value={settingValues[FIELD_IDS.MARKETPLACE_URL]}
                                    isDisabled={generalDisable || !settingValues[FIELD_IDS.ENABLE_UPLOADS] || !settingValues[FIELD_IDS.ENABLE_MARKETPLACE] || !settingValues[FIELD_IDS.ENABLE_REMOTE_MARKETPLACE]}
                                    enableUploads={settingValues[FIELD_IDS.ENABLE_UPLOADS]}
                                />
                            </>
                        )}
                        <PluginsContainer
                            confirmDelete={confirmDelete}
                            loading={loading}
                            isDisabled={isDisabled}
                            setServerError={setOtherServerError}
                        />
                    </SettingsGroup>
                    {overwriteModalProps && <OverwritePluginModal {...overwriteModalProps}/>}
                    {removeModalProps && <RemovePluginModal {...removeModalProps}/>}
                </div>
            </div>
        );
    }, [
        confirmDelete,
        confirmOverwrite,
        generalDisable,
        handleChange,
        isDisabled,
        loading,
        otherServerError,
        overwriteModalProps,
        removeModalProps,
        restrictSystemAdmin,
        settingValues,
    ]);

    useEffect(() => {
        if (settingValues[FIELD_IDS.ENABLE]) {
            dispatch(getPluginStatuses()).then(() => setLoading(false));
        }
    }, []);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            isDisabled={isDisabled || (settingValues[FIELD_IDS.MARKETPLACE_URL] === '')}
            serverError={serverError || otherServerError}
        />
    );
};

export default PluginManagement;
