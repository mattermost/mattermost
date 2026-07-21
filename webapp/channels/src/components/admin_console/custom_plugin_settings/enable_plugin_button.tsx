// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Button} from '@mattermost/shared/components/button';

import {disablePlugin, enablePlugin} from 'mattermost-redux/actions/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import FormError from 'components/form_error';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import {unescapePathPart} from '../schema_admin_settings';

type Props = Pick<SystemConsoleCustomSettingsComponentProps, 'id' | 'disabled' | 'value'> & {
    actions: {
        disablePlugin: (pluginId: string) => Promise<ActionResult>;
        enablePlugin: (pluginId: string) => Promise<ActionResult>;
    };
};

const pluginStatePrefix = 'PluginSettings.PluginStates.';
const pluginStateSuffix = '.Enable';

export function getPluginIdFromEnableSettingId(settingId: string) {
    if (!settingId.startsWith(pluginStatePrefix) || !settingId.endsWith(pluginStateSuffix)) {
        return '';
    }

    return unescapePathPart(settingId.slice(pluginStatePrefix.length, -pluginStateSuffix.length));
}

export function PluginEnableButton({actions, disabled, id, value}: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');
    const pluginId = useMemo(() => getPluginIdFromEnableSettingId(id), [id]);
    const pluginEnabled = Boolean(value);

    const handleTogglePlugin = useCallback(async () => {
        if (!pluginId || submitting || disabled) {
            return;
        }

        setSubmitting(true);
        setServerError('');

        const {error} = pluginEnabled ? await actions.disablePlugin(pluginId) : await actions.enablePlugin(pluginId);
        if (error) {
            setServerError(error.message);
        }

        setSubmitting(false);
    }, [actions, disabled, pluginEnabled, pluginId, submitting]);

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
    if (submitting) {
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

    return (
        <div className='form-group'>
            <div className='col-sm-offset-4 col-sm-8'>
                <Button
                    type='button'
                    emphasis='primary'
                    variant={pluginEnabled ? 'destructive' : undefined}
                    onClick={handleTogglePlugin}
                    disabled={disabled || submitting || !pluginId}
                >
                    {buttonMessage}
                </Button>
                <FormError error={serverError}/>
            </div>
        </div>
    );
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            disablePlugin,
            enablePlugin,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PluginEnableButton);
