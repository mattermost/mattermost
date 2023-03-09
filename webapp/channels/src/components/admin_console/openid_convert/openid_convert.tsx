// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {AdminConfig} from '@mattermost/types/config';

import {BaseProps} from 'components/admin_console/admin_settings';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';

import FormError from 'components/form_error';

import imagePath from 'images/openid-convert/emoticon-outline.svg';

import './openid_convert.scss';
import ExternalLink from 'components/external_link';

type Props = BaseProps & {
    disabled?: boolean;
    actions: {
        updateConfig: (config: AdminConfig) => ActionFunc & Partial<{error?: ClientErrorPlaceholder}>;
    };
};
type State = {
    serverError?: string;
}

type ClientErrorPlaceholder = {
    message: string;
    server_error_id: string;
}

export default class OpenIdConvert extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            serverError: undefined,
        };
    }

    upgradeConfig = async (e: React.MouseEvent) => {
        e.preventDefault();

        const newConfig = JSON.parse(JSON.stringify(this.props.config));

        if (newConfig.Office365Settings.DirectoryId) {
            newConfig.Office365Settings.DiscoveryEndpoint = 'https://login.microsoftonline.com/' + newConfig.Office365Settings.DirectoryId + '/v2.0/.well-known/openid-configuration';
        }
        newConfig.GoogleSettings.DiscoveryEndpoint = 'https://accounts.google.com/.well-known/openid-configuration';

        if (newConfig.GitLabSettings.UserAPIEndpoint) {
            const url = newConfig.GitLabSettings.UserAPIEndpoint.replace('/api/v4/user', '');
            newConfig.GitLabSettings.DiscoveryEndpoint = url + '/.well-known/openid-configuration';
        }

        ['Office365Settings', 'GoogleSettings', 'GitLabSettings'].forEach((setting) => {
            newConfig[setting].Scope = Constants.OPENID_SCOPES;
            newConfig[setting].UserAPIEndpoint = '';
            newConfig[setting].AuthEndpoint = '';
            newConfig[setting].TokenEndpoint = '';
        });

        const {error: err} = await this.props.actions.updateConfig(newConfig);
        if (err) {
            this.setState({serverError: err.message});
        } else {
            getHistory().push('/admin_console/authentication/openid');
        }
    }

    render() {
        return (
            <div className='OpenIdConvert'>
                <div className='OpenIdConvert_imageWrapper'>
                    <img
                        className='OpenIdConvert_image'
                        src={imagePath}
                        alt='OpenId Convert Image'
                    />
                </div>

                <div className='OpenIdConvert_copyWrapper'>
                    <p>
                        <FormattedMessage
                            id='admin.openIdConvert.message'
                            defaultMessage='You can now convert your OAuth2.0 configuration to OpenID Connect.'
                        />
                    </p>
                    <div className='OpenIdConvert_actionWrapper'>
                        <button
                            className='btn'
                            data-testid='openIdConvert'
                            disabled={this.props.disabled}
                            onClick={this.upgradeConfig}
                        >
                            <FormattedMessage
                                id='admin.openIdConvert.text'
                                defaultMessage='Convert to OpenID Connect'
                            />
                        </button>
                        <ExternalLink
                            className='btn-secondary'
                            location='openid_convert'
                            href='https://www.mattermost.com/default-openid-docs'
                            data-testid='openIdLearnMore'
                        >
                            <FormattedMessage
                                id='admin.openIdConvert.help'
                                defaultMessage='Learn more'
                            />
                        </ExternalLink>
                        <div
                            className='error-message'
                            data-testid='errorMessage'
                        >
                            <FormError error={this.state.serverError}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
