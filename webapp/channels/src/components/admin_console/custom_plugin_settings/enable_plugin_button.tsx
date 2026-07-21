// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Button} from '@mattermost/shared/components/button';

import {enablePlugin} from 'mattermost-redux/actions/admin';
import type {ActionResult} from 'mattermost-redux/types/actions';

import FormError from 'components/form_error';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';
import {unescapePathPart} from '../schema_admin_settings';

type Props = Pick<SystemConsoleCustomSettingsComponentProps, 'id' | 'disabled'> & {
    actions: {
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

export function PluginEnableButton({actions, disabled, id}: Props) {
    const [enabling, setEnabling] = useState(false);
    const [serverError, setServerError] = useState('');
    const pluginId = useMemo(() => getPluginIdFromEnableSettingId(id), [id]);

    const handleEnablePlugin = useCallback(async () => {
        if (!pluginId || enabling || disabled) {
            return;
        }

        setEnabling(true);
        setServerError('');

        const {error} = await actions.enablePlugin(pluginId);
        if (error) {
            setServerError(error.message);
        }

        setEnabling(false);
    }, [actions, disabled, enabling, pluginId]);

    return (
        <div className='form-group'>
            <Button
                type='button'
                emphasis='primary'
                onClick={handleEnablePlugin}
                disabled={disabled || enabling || !pluginId}
            >
                {enabling ? (
                    <FormattedMessage
                        id='admin.plugin.enabling'
                        defaultMessage='Enabling...'
                    />
                ) : (
                    <FormattedMessage
                        id='admin.plugin.enable_plugin.button'
                        defaultMessage='Enable plugin'
                    />
                )}
            </Button>
            <FormError error={serverError}/>
        </div>
    );
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            enablePlugin,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PluginEnableButton);
