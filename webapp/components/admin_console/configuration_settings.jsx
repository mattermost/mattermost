// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import ReloadConfigButton from './reload_config.jsx';

export default class ConfigurationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            listenAddress: props.config.ServiceSettings.ListenAddress
        });
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.config.ServiceSettings.ListenAddress !== this.props.config.ServiceSettings.ListenAddress) {
            this.setState({listenAddress: nextProps.config.ServiceSettings.ListenAddress});
        }
    }

    getConfigFromState(config) {
        config.ServiceSettings.ListenAddress = this.state.listenAddress;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.configuration'
                    defaultMessage='Configuration'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='listenAddress'
                    label={
                        <FormattedMessage
                            id='admin.service.listenAddress'
                            defaultMessage='Listen Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.listenExample', 'Ex ":8065"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.listenDescription'
                            defaultMessage='The address to which to bind and listen. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065".  Changing this will require a server restart before taking effect.'
                        />
                    }
                    value={this.state.listenAddress}
                    onChange={this.handleChange}
                />
                <ReloadConfigButton/>
            </SettingsGroup>
        );
    }
}