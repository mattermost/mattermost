// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Button} from '@mattermost/shared/components/button';

import {disablePlugin, enablePlugin, removePlugin} from 'mattermost-redux/actions/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';

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
    const [submittingAction, setSubmittingAction] = useState<'toggle' | 'remove' | ''>('');
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [serverError, setServerError] = useState<React.ReactNode>('');
    const pluginId = useMemo(() => getPluginIdFromEnableSettingId(id), [id]);
    const pluginEnabled = Boolean(value);

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
        if (!pluginId || submittingAction || disabled) {
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
    }, [actions, disabled, guardUnsavedChanges, pluginEnabled, pluginId, submittingAction]);

    const handleShowRemoveModal = useCallback(() => {
        if (!pluginId || submittingAction || disabled) {
            return;
        }

        if (guardUnsavedChanges()) {
            return;
        }

        setServerError('');
        setShowRemoveModal(true);
    }, [disabled, guardUnsavedChanges, pluginId, submittingAction]);

    const handleRemovePluginCancel = useCallback(() => {
        setShowRemoveModal(false);
    }, []);

    const handleRemovePlugin = useCallback(async () => {
        if (!pluginId || submittingAction || disabled) {
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
    }, [actions, disabled, guardUnsavedChanges, pluginId, submittingAction]);

    let buttonMessage = pluginEnabled ? (
        <FormattedMessage
            id='admin.plugin.disable_plugin.button'
            defaultMessage='Disable plugin'
        />
    ) : (
        <FormattedMessage
            id='admin.plugin.enable_plugin.button'
            defaultMessage='Enable plugin'
        />
    );
    if (submittingAction === 'toggle') {
        buttonMessage = pluginEnabled ? (
            <FormattedMessage
                id='admin.plugin.disabling'
                defaultMessage='Disabling...'
            />
        ) : (
            <FormattedMessage
                id='admin.plugin.enabling'
                defaultMessage='Enabling...'
            />
        );
    }

    const removeButtonMessage = submittingAction === 'remove' ? (
        <FormattedMessage
            id='admin.plugin.removing'
            defaultMessage='Removing...'
        />
    ) : (
        <FormattedMessage
            id='admin.plugin.uninstall_plugin.button'
            defaultMessage='Uninstall plugin'
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
        <div className='PluginMetadataPanel__actions'>
            <Button
                type='button'
                emphasis={pluginEnabled ? 'secondary' : 'primary'}
                onClick={handleTogglePlugin}
                disabled={disabled || Boolean(submittingAction) || !pluginId}
            >
                {buttonMessage}
            </Button>
            <Button
                type='button'
                className='ml-2'
                emphasis='secondary'
                variant='destructive'
                onClick={handleShowRemoveModal}
                disabled={disabled || Boolean(submittingAction) || !pluginId}
            >
                {removeButtonMessage}
            </Button>
            <FormError error={serverError}/>
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
