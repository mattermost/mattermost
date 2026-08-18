// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {DotsHorizontalIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';

import {disablePlugin, enablePlugin, removePlugin} from 'mattermost-redux/actions/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import * as Menu from 'components/menu';
import Toggle from 'components/toggle';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {getHistory} from 'utils/browser_history';

type Props = {
    actions: {
        disablePlugin: (pluginId: string) => Promise<ActionResult>;
        enablePlugin: (pluginId: string) => Promise<ActionResult>;
        removePlugin: (pluginId: string) => Promise<ActionResult>;
    };
    disabled: boolean;
    id: string;
    saveNeeded?: false | string;
    value: boolean;
};

const pluginStatePrefix = 'PluginSettings.PluginStates.';
const pluginStateSuffix = '.Enable';

export function getPluginIdFromEnableSettingId(settingId: string) {
    if (!settingId.startsWith(pluginStatePrefix) || !settingId.endsWith(pluginStateSuffix)) {
        return '';
    }

    return settingId.slice(pluginStatePrefix.length, -pluginStateSuffix.length).replace(/\+/g, '.');
}

export function PluginEnableButton({actions, disabled, id, saveNeeded = false, value}: Props) {
    const {formatMessage} = useIntl();
    const [submittingAction, setSubmittingAction] = useState<'toggle' | 'remove' | ''>('');
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [serverError, setServerError] = useState<React.ReactNode>('');
    const pluginId = useMemo(() => getPluginIdFromEnableSettingId(id), [id]);
    const pluginEnabled = Boolean(value);
    const toggling = submittingAction === 'toggle';
    const actionsDisabled = disabled || Boolean(submittingAction) || !pluginId;

    const guardUnsavedChanges = useCallback(() => {
        if (saveNeeded === false) {
            return false;
        }

        setServerError(
            <FormattedMessage
                id='admin_settings.save_unsaved_changes'
                defaultMessage='Please save unsaved changes first'
            />,
        );
        return true;
    }, [saveNeeded]);

    const handleTogglePlugin = useCallback(async () => {
        if (actionsDisabled) {
            return;
        }

        if (guardUnsavedChanges()) {
            return;
        }

        setSubmittingAction('toggle');
        setServerError('');

        const {error} = pluginEnabled ? await actions.disablePlugin(pluginId) : await actions.enablePlugin(pluginId);
        if (error) {
            setServerError(error.message);
        }

        setSubmittingAction('');
    }, [actions, actionsDisabled, guardUnsavedChanges, pluginEnabled, pluginId]);

    const handleShowRemoveModal = useCallback(() => {
        if (actionsDisabled) {
            return;
        }

        if (guardUnsavedChanges()) {
            return;
        }

        setServerError('');
        setShowRemoveModal(true);
    }, [actionsDisabled, guardUnsavedChanges]);

    const handleRemovePluginCancel = useCallback(() => {
        setShowRemoveModal(false);
    }, []);

    const handleRemovePlugin = useCallback(async () => {
        if (actionsDisabled) {
            return;
        }

        if (guardUnsavedChanges()) {
            setShowRemoveModal(false);
            return;
        }

        setShowRemoveModal(false);
        setSubmittingAction('remove');
        setServerError('');

        const {error} = await actions.removePlugin(pluginId);
        if (error) {
            setServerError(error.message);
            setSubmittingAction('');
            return;
        }

        getHistory().push('/admin_console/plugins/plugin_management');
    }, [actions, actionsDisabled, guardUnsavedChanges, pluginId]);

    const toggleAriaLabel = pluginEnabled ? formatMessage({
        id: 'admin.plugin.disable_plugin.button',
        defaultMessage: 'Disable plugin',
    }) : formatMessage({
        id: 'admin.plugin.enable_plugin.button',
        defaultMessage: 'Enable plugin',
    });

    const loadingLabel = pluginEnabled ? (
        <FormattedMessage
            id='admin.plugin.disabling.toggle'
            defaultMessage='Disabling'
        />
    ) : (
        <FormattedMessage
            id='admin.plugin.enabling.toggle'
            defaultMessage='Enabling'
        />
    );

    const removePluginModal = showRemoveModal && (
        <ConfirmModal
            show={showRemoveModal}
            title={
                <FormattedMessage
                    id='admin.plugin.remove_modal.title'
                    defaultMessage='Remove plugin?'
                />
            }
            message={
                <FormattedMessage
                    id='admin.plugin.remove_modal.desc'
                    defaultMessage='Are you sure you would like to remove the plugin?'
                />
            }
            confirmButtonVariant='destructive'
            confirmButtonText={
                <FormattedMessage
                    id='admin.plugin.remove_modal.overwrite'
                    defaultMessage='Remove'
                />
            }
            onConfirm={handleRemovePlugin}
            onCancel={handleRemovePluginCancel}
        />
    );

    return (
        <div className='PluginMetadataPanel__controls'>
            <div className='PluginMetadataPanel__actions'>
                <div className='PluginMetadataPanel__enable'>
                    {toggling ? (
                        <LoadingSpinner text={loadingLabel}/>
                    ) : (
                        <FormattedMessage
                            id={pluginEnabled ? 'admin.plugin.enabled.toggle' : 'admin.plugin.disabled.toggle'}
                            defaultMessage={pluginEnabled ? 'Enabled' : 'Disabled'}
                        />
                    )}
                    <Toggle
                        size='btn-sm'
                        disabled={actionsDisabled}
                        toggled={pluginEnabled}
                        id={id}
                        ariaLabel={toggleAriaLabel}
                        toggleClassName='btn-toggle-primary'
                        onToggle={handleTogglePlugin}
                    />
                </div>
                <Menu.Container
                    menuButton={{
                        id: `plugin-actions-menu-button-${pluginId}`,
                        class: `btn btn-icon btn-sm PluginMetadataPanel__menuButton${actionsDisabled ? ' disabled' : ''}`,
                        disabled: actionsDisabled,
                        'aria-label': formatMessage({id: 'admin.plugin.actions.menu.aria_label', defaultMessage: 'Plugin actions'}),
                        children: <DotsHorizontalIcon size={16}/>,
                    }}
                    menu={{
                        id: `plugin-actions-menu-${pluginId}`,
                        'aria-label': formatMessage({id: 'admin.plugin.actions.menu.aria_label', defaultMessage: 'Plugin actions'}),
                    }}
                >
                    <Menu.Item
                        id={`plugin-actions-uninstall-${pluginId}`}
                        isDestructive={true}
                        leadingElement={<TrashCanOutlineIcon size={18}/>}
                        labels={
                            <FormattedMessage
                                id='admin.plugin.uninstall_plugin.button'
                                defaultMessage='Uninstall plugin'
                            />
                        }
                        onClick={handleShowRemoveModal}
                    />
                </Menu.Container>
            </div>
            {serverError && (
                <div className='PluginMetadataPanel__actionError'>
                    <i className='fa fa-exclamation-circle'/>
                    {serverError}
                </div>
            )}
            {removePluginModal}
        </div>
    );
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            disablePlugin,
            enablePlugin,
            removePlugin,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PluginEnableButton);
