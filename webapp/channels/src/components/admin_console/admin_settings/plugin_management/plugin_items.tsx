// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import PluginState from 'mattermost-redux/constants/plugins';

import {appsPluginID} from 'utils/apps';

const PluginItemState = ({state}: {state: number}) => {
    switch (state) {
    case PluginState.PLUGIN_STATE_NOT_RUNNING:
        return (
            <FormattedMessage
                id='admin.plugin.state.not_running'
                defaultMessage='Not running'
            />
        );
    case PluginState.PLUGIN_STATE_STARTING:
        return (
            <FormattedMessage
                id='admin.plugin.state.starting'
                defaultMessage='Starting'
            />
        );
    case PluginState.PLUGIN_STATE_RUNNING:
        return (
            <FormattedMessage
                id='admin.plugin.state.running'
                defaultMessage='Running'
            />
        );
    case PluginState.PLUGIN_STATE_FAILED_TO_START:
        return (
            <FormattedMessage
                id='admin.plugin.state.failed_to_start'
                defaultMessage='Failed to start'
            />
        );
    case PluginState.PLUGIN_STATE_FAILED_TO_STAY_RUNNING:
        return (
            <FormattedMessage
                id='admin.plugin.state.failed_to_stay_running'
                defaultMessage='Crashing'
            />
        );
    case PluginState.PLUGIN_STATE_STOPPING:
        return (
            <FormattedMessage
                id='admin.plugin.state.stopping'
                defaultMessage='Stopping'
            />
        );
    default:
        return (
            <FormattedMessage
                id='admin.plugin.state.unknown'
                defaultMessage='Unknown'
            />
        );
    }
};

const PluginItemStateDescription = ({state, error}: {state: number; error?: string}) => {
    switch (state) {
    case PluginState.PLUGIN_STATE_NOT_RUNNING:
        return (
            <div className='alert alert-info'>
                <i className='fa fa-ban'/>
                <FormattedMessage
                    id='admin.plugin.state.not_running.description'
                    defaultMessage='This plugin is not enabled.'
                />
            </div>
        );
    case PluginState.PLUGIN_STATE_STARTING:
        return (
            <div className='alert alert-success'>
                <i className='fa fa-info'/>
                <FormattedMessage
                    id='admin.plugin.state.starting.description'
                    defaultMessage='This plugin is starting.'
                />
            </div>
        );
    case PluginState.PLUGIN_STATE_RUNNING:
        return (
            <div className='alert alert-success'>
                <i className='fa fa-check'/>
                <FormattedMessage
                    id='admin.plugin.state.running.description'
                    defaultMessage='This plugin is running.'
                />
            </div>
        );
    case PluginState.PLUGIN_STATE_FAILED_TO_START: {
        const errorMessage = error || (
            <FormattedMessage
                id='admin.plugin.state.failed_to_start.check_logs'
                defaultMessage='Check your system logs for errors.'
            />
        );

        return (
            <div className='alert alert-warning'>
                <i className='fa fa-warning'/>
                <FormattedMessage
                    id='admin.plugin.state.failed_to_start.description'
                    defaultMessage='This plugin failed to start. {error}'
                    values={{
                        error: errorMessage,
                    }}
                />
            </div>
        );
    }
    case PluginState.PLUGIN_STATE_FAILED_TO_STAY_RUNNING:
        return (
            <div className='alert alert-warning'>
                <i className='fa fa-warning'/>
                <FormattedMessage
                    id='admin.plugin.state.failed_to_stay_running.description'
                    defaultMessage='This plugin crashed multiple times and is no longer running. Check your system logs for errors.'
                />
            </div>
        );
    case PluginState.PLUGIN_STATE_STOPPING:
        return (
            <div className='alert alert-info'>
                <i className='fa fa-info'/>
                <FormattedMessage
                    id='admin.plugin.state.stopping.description'
                    defaultMessage='This plugin is stopping.'
                />
            </div>
        );
    default:
        return null;
    }
};

type PluginItemProps = {
    pluginStatus: PluginStatus;
    removing: boolean;
    handleEnable: (e: any) => any;
    handleDisable: (e: any) => any;
    handleRemove: (e: any) => any;
    showInstances: boolean;
    hasSettings: boolean;
    appsFeatureFlagEnabled: boolean;
    isDisabled?: boolean;
};

const PluginItem = ({
    pluginStatus,
    removing,
    handleEnable,
    handleDisable,
    handleRemove,
    showInstances,
    hasSettings,
    appsFeatureFlagEnabled,
    isDisabled,
}: PluginItemProps) => {
    let activateButton: React.ReactNode;
    const activating = pluginStatus.state === PluginState.PLUGIN_STATE_STARTING;
    const deactivating = pluginStatus.state === PluginState.PLUGIN_STATE_STOPPING;

    if (pluginStatus.active) {
        activateButton = (
            <a
                data-plugin-id={pluginStatus.id}
                className={deactivating || isDisabled ? 'disabled' : ''}
                onClick={handleDisable}
            >
                {deactivating ? (
                    <FormattedMessage
                        id='admin.plugin.disabling'
                        defaultMessage='Disabling...'
                    />
                ) : (
                    <FormattedMessage
                        id='admin.plugin.disable'
                        defaultMessage='Disable'
                    />
                )}
            </a>
        );
    } else {
        activateButton = (
            <a
                data-plugin-id={pluginStatus.id}
                className={activating || isDisabled ? 'disabled' : ''}
                onClick={handleEnable}
            >
                {activating ? (
                    <FormattedMessage
                        id='admin.plugin.enabling'
                        defaultMessage='Enabling...'
                    />
                ) : (
                    <FormattedMessage
                        id='admin.plugin.enable'
                        defaultMessage='Enable'
                    />
                )}
            </a>
        );
    }

    let settingsButton = null;
    if (hasSettings) {
        settingsButton = (
            <span>
                {' - '}
                <Link
                    to={'/admin_console/plugins/plugin_' + pluginStatus.id}
                >
                    <FormattedMessage
                        id='admin.plugin.settingsButton'
                        defaultMessage='Settings'
                    />
                </Link>
            </span>
        );
    }

    let removeButtonText;
    if (removing) {
        removeButtonText = (
            <FormattedMessage
                id='admin.plugin.removing'
                defaultMessage='Removing...'
            />
        );
    } else {
        removeButtonText = (
            <FormattedMessage
                id='admin.plugin.remove'
                defaultMessage='Remove'
            />
        );
    }
    let removeButton: React.ReactNode = (
        <span>
            {' - '}
            <a
                data-plugin-id={pluginStatus.id}
                className={removing || isDisabled ? 'disabled' : ''}
                onClick={handleRemove}
            >
                {removeButtonText}
            </a>
        </span>
    );

    let description;
    if (pluginStatus.description) {
        description = (
            <div className='pt-2'>
                {pluginStatus.description}
            </div>
        );
    }

    const notices = [];
    if (pluginStatus.instances.some((instance) => instance.version !== pluginStatus.version)) {
        notices.push(
            <div
                key='multiple-versions'
                className='alert alert-warning'
            >
                <i className='fa fa-warning'/>
                <FormattedMessage
                    id='admin.plugin.multiple_versions_warning'
                    defaultMessage='There are multiple versions of this plugin installed across your cluster. Re-install this plugin to ensure it works consistently.'
                />
            </div>,
        );
    }

    notices.push(
        <PluginItemStateDescription
            key='state-description'
            state={pluginStatus.state}
            error={pluginStatus.error}
        />,
    );

    const instances = pluginStatus.instances.slice();
    instances.sort((a, b) => {
        if (a.cluster_id < b.cluster_id) {
            return -1;
        } else if (a.cluster_id > b.cluster_id) {
            return 1;
        }

        return 0;
    });

    let clusterSummary;
    if (showInstances) {
        clusterSummary = (
            <div className='pt-3 pb-3'>
                <div className='row'>
                    <div className='col-md-6'>
                        <strong>
                            <FormattedMessage
                                id='admin.plugin.cluster_instance'
                                defaultMessage='Cluster Instance'
                            />
                        </strong>
                    </div>
                    <div className='col-md-3'>
                        <strong>
                            <FormattedMessage
                                id='admin.plugin.version_title'
                                defaultMessage='Version'
                            />
                        </strong>
                    </div>
                    <div className='col-md-3'>
                        <strong>
                            <FormattedMessage
                                id='admin.plugin.state'
                                defaultMessage='State'
                            />
                        </strong>
                    </div>
                </div>
                {instances.map((instance) => (
                    <div
                        key={instance.cluster_id}
                        className='row'
                    >
                        <div className='col-md-6'>
                            {instance.cluster_id}
                        </div>
                        <div className='col-md-3'>
                            {instance.version}
                        </div>
                        <div className='col-md-3'>
                            <PluginItemState state={instance.state}/>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (pluginStatus.id === appsPluginID && !appsFeatureFlagEnabled) {
        activateButton = (<>{'Plugin disabled by feature flag'}</>);
        removeButton = null;
    }

    return (
        <div data-testid={pluginStatus.id}>
            <div>
                <strong>{pluginStatus.name}</strong>
                {' ('}
                {pluginStatus.id}
                {' - '}
                {pluginStatus.version}
                {')'}
            </div>
            {description}
            <div className='pt-2'>
                {activateButton}
                {removeButton}
                {settingsButton}
            </div>
            <div>
                {notices}
            </div>
            <div>
                {clusterSummary}
            </div>
            <hr/>
        </div>
    );
};

export default PluginItem;
