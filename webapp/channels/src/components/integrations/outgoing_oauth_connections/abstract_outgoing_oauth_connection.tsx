// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, FormEvent} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {Permissions} from 'mattermost-redux/constants';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import SpinnerButton from 'components/spinner_button';

import {localizeMessage} from 'utils/utils';

type Props = {

    /**
   * The current team
   */
    team: Team;

    /**
   * The header text to render, has id and defaultMessage
   */
    header: MessageDescriptor;

    /**
   * The footer text to render, has id and defaultMessage
   */
    footer: MessageDescriptor;

    /**
   * The spinner loading text to render, has id and defaultMessage
   */
    loading: MessageDescriptor;

    /**
   * Any extra component/node to render
   */
    renderExtra?: JSX.Element;

    /**
    * The server error text after a failed action
    */
    serverError: string;

    initialConnection?: OutgoingOAuthConnection;

    /**
    * The async function to run when the action button is pressed
    */
    action: (connection: OutgoingOAuthConnection) => Promise<void>;

}

type State = {
    name: string;
    oauthTokenUrl: string;
    grantType: OutgoingOAuthConnection['grant_type'];
    clientId: string;
    clientSecret: string;
    audienceUrls: string;
    saving: boolean;
    clientError: JSX.Element | null | string;
};

export default class AbstractOutgoingOAuthConnection extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = this.getStateFromConnection(this.props.initialConnection || {} as OutgoingOAuthConnection);
    }

    getStateFromConnection = (connection: OutgoingOAuthConnection): State => {
        return {
            name: connection.name || '',
            audienceUrls: connection.audiences ? connection.audiences.join('\n') : '',
            oauthTokenUrl: connection.oauth_token_url || '',
            clientId: connection.client_id || '',
            clientSecret: connection.client_secret || '',
            grantType: 'client_credentials',
            saving: false,
            clientError: null,
        };
    };

    handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            clientError: '',
        });

        if (!this.state.name) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.nameRequired'
                        defaultMessage='Name for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.clientId) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.client_id'
                        defaultMessage='Client Id for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.clientSecret) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.client_secret'
                        defaultMessage='Client Secret for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.grantType) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.grant_type'
                        defaultMessage='Grant Type for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.oauthTokenUrl) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.oauth_token_url'
                        defaultMessage='OAuth Token URL for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        const audienceUrls = [];
        for (let audienceUrl of this.state.audienceUrls.split('\n')) {
            audienceUrl = audienceUrl.trim();

            if (audienceUrl.length > 0) {
                audienceUrls.push(audienceUrl);
            }
        }

        if (audienceUrls.length === 0) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.callbackUrlsRequired'
                        defaultMessage='One or more audience URLs are required.'
                    />
                ),
            });

            return;
        }

        const connection = {
            name: this.state.name,
            audiences: audienceUrls,
            client_id: this.state.clientId,
            client_secret: this.state.clientSecret,
            grant_type: this.state.grantType,
            oauth_token_url: this.state.oauthTokenUrl,
        } as OutgoingOAuthConnection;

        this.props.action(connection).then(() => this.setState({saving: false}));
    };

    updateName = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            name: e.target.value,
        });
    };

    updateClientId = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            clientId: e.target.value,
        });
    };

    updateClientSecret = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            clientSecret: e.target.value,
        });
    };

    updateOAuthTokenURL = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            oauthTokenUrl: e.target.value,
        });
    };

    updateAudienceUrls = (e: ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({
            audienceUrls: e.target.value,
        });
    };

    render() {
        const headerToRender = this.props.header;
        const footerToRender = this.props.footer;
        const renderExtra = this.props.renderExtra;

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/outgoing-oauth2-connections`}>
                        <FormattedMessage
                            id='installed_outgoing_oauth_connections.header'
                            defaultMessage='Outgoing OAuth Connections'
                        />
                    </Link>
                    <FormattedMessage
                        id={headerToRender.id}
                        defaultMessage={headerToRender.defaultMessage}
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    <form className='form-horizontal'>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='name'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.name'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='name'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.name}
                                    onChange={this.updateName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.name.help'
                                        defaultMessage='Specify the display name for your OAuth connection.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='client_id'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.client_id'
                                    defaultMessage='Client ID'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='name'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.clientId}
                                    onChange={this.updateClientId}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.client_id.help'
                                        defaultMessage='Specify the Client ID for your OAuth connection.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='client_secret'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.client_secret'
                                    defaultMessage='Client Secret'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='name'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={'*'.repeat(this.state.clientSecret.length)}
                                    onChange={this.updateClientSecret}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.client_secret.help'
                                        defaultMessage='Specify the Client Secret for your OAuth connection.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='oauth_token_url'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.oauth_token_url'
                                    defaultMessage='OAuth Token URL'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='name'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.oauthTokenUrl}
                                    onChange={this.updateOAuthTokenURL}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.oauth_token_url.help'
                                        defaultMessage='Specify the OAuth Token URL for your OAuth connection.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='audienceUrls'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.audienceUrls'
                                    defaultMessage='Audience URLs (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <textarea
                                    id='audienceUrls'
                                    rows={3}
                                    maxLength={1024}
                                    className='form-control'
                                    value={this.state.audienceUrls}
                                    onChange={this.updateAudienceUrls}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.audienceUrls.help'
                                        defaultMessage='The audience URIs which will receive requests with the OAuth token. Must be a valid URL and start with http:// or https://.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.props.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-tertiary'
                                to={`/${this.props.team.name}/integrations/outgoing-oauth2-connections`}
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.saving}
                                spinningText={localizeMessage(this.props.loading?.id || '', (this.props.loading?.defaultMessage || '') as string)}
                                onClick={this.handleSubmit}
                                id='saveOauthApp'
                            >
                                <FormattedMessage
                                    id={footerToRender.id}
                                    defaultMessage={footerToRender.defaultMessage}
                                />
                            </SpinnerButton>
                            {renderExtra}
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
