// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {disablePlugin, enablePlugin, removePlugin} from 'mattermost-redux/actions/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {appsFeatureFlagEnabled} from 'mattermost-redux/selectors/entities/apps';

import LoadingScreen from 'components/loading_screen';

import type {GlobalState} from 'types/store';

import {messages} from './messages';
import PluginItem from './plugin_items';

type Props = {
    loading: boolean;
    isDisabled?: boolean;
    confirmDelete: (onAccept: () => void, onCancel: () => void) => void;
    setServerError: (value: string | undefined) => void;
}

const PluginsContainer = ({
    loading,
    isDisabled,
    confirmDelete,
    setServerError,
}: Props) => {
    const dispatch = useDispatch();

    const removing = useRef<string | null>(null);

    const pluginsEnabled = useSelector((state: GlobalState) => getConfig(state).PluginSettings?.Enable);
    const pluginStatuses = useSelector((state: GlobalState) => state.entities.admin.pluginStatuses);
    const pluginList = useSelector((state: GlobalState) => state.entities.admin.plugins);
    const appsFFEnabled = useSelector(appsFeatureFlagEnabled);

    const handleEnable = useCallback(async (e: React.KeyboardEvent) => {
        e.preventDefault();
        if (isDisabled) {
            return;
        }

        // this.setState({lastMessage: null, serverError: null});
        setServerError(undefined);
        const pluginId = e.currentTarget.getAttribute('data-plugin-id');

        if (pluginId) {
            const {error} = await dispatch(enablePlugin(pluginId));

            if (error) {
                setServerError(error.message);
            }
        }
    }, [dispatch, isDisabled, setServerError]);

    const handleDisable = useCallback(async (e: React.KeyboardEvent) => {
        e.preventDefault();
        if (isDisabled) {
            return;
        }

        //this.setState({lastMessage: null, serverError: null});
        setServerError(undefined);

        const pluginId = e.currentTarget.getAttribute('data-plugin-id');
        if (pluginId) {
            const {error} = await dispatch(disablePlugin(pluginId));

            if (error) {
                setServerError(error.message);
            }
        }
    }, [dispatch, isDisabled, setServerError]);

    const handleRemove = useCallback(async () => {
        // this.setState({lastMessage: null, serverError: null});
        setServerError(undefined);
        if (removing.current !== null) {
            const {error} = await dispatch(removePlugin(removing.current));
            removing.current = null;

            if (error) {
                setServerError(error.message);
            }
        }
    }, [dispatch, setServerError]);

    const showRemovePluginModal = useCallback((e: React.SyntheticEvent) => {
        if (isDisabled) {
            return;
        }
        e.preventDefault();
        const pluginId = e.currentTarget.getAttribute('data-plugin-id');
        removing.current = pluginId;
        confirmDelete(handleRemove, () => {
            removing.current = null;
        });
    }, [confirmDelete, handleRemove, isDisabled]);

    if (!pluginsEnabled) {
        return null;
    }

    let pluginsList;
    let pluginsListContainer;
    const plugins = Object.values(pluginStatuses || {});
    if (loading) {
        pluginsList = <LoadingScreen/>;
    } else if (plugins.length === 0) {
        pluginsListContainer = (
            <FormattedMessage
                id='admin.plugin.no_plugins'
                defaultMessage='No installed plugins.'
            />
        );
    } else {
        const showInstances = plugins.some((pluginStatus) => pluginStatus.instances.length > 1);
        plugins.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) {
                return nameCompare;
            }

            return a.id.localeCompare(b.id);
        });
        pluginsList = plugins.map((pluginStatus: PluginStatus) => {
            const p = pluginList?.[pluginStatus.id];
            const hasSettings = Boolean(p && p.settings_schema && (p.settings_schema.header || p.settings_schema.footer || (p.settings_schema.settings && p.settings_schema.settings.length > 0)));
            return (
                <PluginItem
                    key={pluginStatus.id}
                    pluginStatus={pluginStatus}
                    removing={removing.current === pluginStatus.id}
                    handleEnable={handleEnable}
                    handleDisable={handleDisable}
                    handleRemove={showRemovePluginModal}
                    showInstances={showInstances}
                    hasSettings={hasSettings}
                    appsFeatureFlagEnabled={appsFFEnabled}
                    isDisabled={isDisabled}
                />
            );
        });

        pluginsListContainer = (
            <div className='alert alert-transparent'>
                {pluginsList}
            </div>
        );
    }
    return (
        <div className='form-group'>
            <label className='control-label col-sm-4'>
                <FormattedMessage {...messages.installedTitle}/>
            </label>
            <div className='col-sm-8'>
                <p className='help-text'>
                    <FormattedMessage {...messages.installedDesc}/>
                </p>
                <br/>
                {pluginsListContainer}
            </div>
        </div>
    );
};

export default PluginsContainer;
