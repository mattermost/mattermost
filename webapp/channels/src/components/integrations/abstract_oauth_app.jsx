// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {Permissions} from 'mattermost-redux/constants';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import SpinnerButton from 'components/spinner_button';

import {localizeMessage} from 'utils/utils';

export default class AbstractOAuthApp extends React.PureComponent {
    static propTypes = {

        /**
        * The current team
        */
        team: PropTypes.object.isRequired,

        /**
        * The header text to render, has id and defaultMessage
        */
        header: PropTypes.object.isRequired,

        /**
        * The footer text to render, has id and defaultMessage
        */
        footer: PropTypes.object.isRequired,

        /**
        * The spinner loading text to render, has id and defaultMessage
        */
        loading: PropTypes.object.isRequired,

        /**
         * Any extra component/node to render
         */
        renderExtra: PropTypes.node.isRequired,

        /**
        * The server error text after a failed action
        */
        serverError: PropTypes.string.isRequired,

        /**
        * The OAuthApp used to set the initial state
        */
        initialApp: PropTypes.object,

        /**
        * The async function to run when the action button is pressed
        */
        action: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.image = new Image();
        this.image.onload = this.imageLoaded;
        this.icon_url = React.createRef();
        this.state = this.getStateFromApp(this.props.initialApp || {});
    }

    getStateFromApp = (app) => {
        return {
            name: app.name || '',
            description: app.description || '',
            homepage: app.homepage || '',
            icon_url: app.icon_url || '',
            callbackUrls: app.callback_urls ? app.callback_urls.join('\n') : '',
            is_trusted: app.is_trusted || false,
            has_icon: Boolean(app.icon_url),
            saving: false,
            clientError: null,
        };
    };

    imageLoaded = () => {
        this.setState({
            has_icon: true,
            icon_url: this.icon_url.current.value,
        });
    };

    handleSubmit = (e) => {
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
                        defaultMessage='Name for the OAuth 2.0 application is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.description) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.descriptionRequired'
                        defaultMessage='Description for the OAuth 2.0 application is required.'
                    />
                ),
            });

            return;
        }

        if (!this.state.homepage) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.homepageRequired'
                        defaultMessage='Homepage for the OAuth 2.0 application is required.'
                    />
                ),
            });

            return;
        }

        const callbackUrls = [];
        for (let callbackUrl of this.state.callbackUrls.split('\n')) {
            callbackUrl = callbackUrl.trim();

            if (callbackUrl.length > 0) {
                callbackUrls.push(callbackUrl);
            }
        }

        if (callbackUrls.length === 0) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.callbackUrlsRequired'
                        defaultMessage='One or more callback URLs are required.'
                    />
                ),
            });

            return;
        }

        const app = {
            name: this.state.name,
            callback_urls: callbackUrls,
            homepage: this.state.homepage,
            description: this.state.description,
            is_trusted: this.state.is_trusted,
            icon_url: this.state.icon_url,
        };

        this.props.action(app).then(() => this.setState({saving: false}));
    };

    updateName = (e) => {
        this.setState({
            name: e.target.value,
        });
    };

    updateTrusted = (e) => {
        this.setState({
            is_trusted: e.target.value === 'true',
        });
    };

    updateDescription = (e) => {
        this.setState({
            description: e.target.value,
        });
    };

    updateHomepage = (e) => {
        this.setState({
            homepage: e.target.value,
        });
    };

    updateIconUrl = (e) => {
        this.setState({
            has_icon: false,
            icon_url: e.target.value,
        });
        this.image.src = e.target.value;
    };

    updateCallbackUrls = (e) => {
        this.setState({
            callbackUrls: e.target.value,
        });
    };

    render() {
        const headerToRender = this.props.header;
        const footerToRender = this.props.footer;
        const renderExtra = this.props.renderExtra;

        let icon;
        if (this.state.has_icon) {
            icon = (
                <div className='integration__icon'>
                    <img
                        alt={'integration icon'}
                        src={this.state.icon_url}
                    />
                </div>
            );
        }

        const trusted = (
            <SystemPermissionGate permissions={[Permissions.MANAGE_SYSTEM]}>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='is_trusted'
                    >
                        <FormattedMessage
                            id='installed_oauth_apps.trusted'
                            defaultMessage='Is Trusted'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8'>
                        <label className='radio-inline'>
                            <input
                                type='radio'
                                value='true'
                                name='is_trusted'
                                checked={this.state.is_trusted}
                                onChange={this.updateTrusted}
                            />
                            <FormattedMessage
                                id='installed_oauth_apps.trusted.yes'
                                defaultMessage='Yes'
                            />
                        </label>
                        <label className='radio-inline'>
                            <input
                                type='radio'
                                value='false'
                                name='is_trusted'
                                checked={!this.state.is_trusted}
                                onChange={this.updateTrusted}
                            />
                            <FormattedMessage
                                id='installed_oauth_apps.trusted.no'
                                defaultMessage='No'
                            />
                        </label>
                        <div className='form__help'>
                            <FormattedMessage
                                id='add_oauth_app.trusted.help'
                                defaultMessage='If true, the OAuth 2.0 application is considered trusted by the Mattermost server and does not require the user to accept authorization. If false, a window opens to ask the user to accept or deny the authorization.'
                            />
                        </div>
                    </div>
                </div>
            </SystemPermissionGate>
        );

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/oauth2-apps`}>
                        <FormattedMessage
                            id='installed_oauth_apps.header'
                            defaultMessage='Installed OAuth2 Apps'
                        />
                    </Link>
                    <FormattedMessage
                        id={headerToRender.id}
                        defaultMessage={headerToRender.defaultMessage}
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    {icon}
                    <form className='form-horizontal'>
                        {trusted}
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
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.name}
                                    onChange={this.updateName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.name.help'
                                        defaultMessage='Specify the display name, of up to 64 characters, for your OAuth 2.0 application.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength='512'
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.description.help'
                                        defaultMessage='Describe your OAuth 2.0 application.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='homepage'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.homepage'
                                    defaultMessage='Homepage'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='homepage'
                                    type='url'
                                    maxLength='256'
                                    className='form-control'
                                    value={this.state.homepage}
                                    onChange={this.updateHomepage}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.homepage.help'
                                        defaultMessage='This is the URL for the homepage of the OAuth 2.0 application. Depending on your server configuration, use HTTP or HTTPS in the URL.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='icon_url'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.iconUrl'
                                    defaultMessage='Icon URL'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='icon_url'
                                    ref={this.icon_url}
                                    type='url'
                                    maxLength='512'
                                    className='form-control'
                                    value={this.state.icon_url}
                                    onChange={this.updateIconUrl}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.icon.help'
                                        defaultMessage='(Optional) The URL of the image used for your OAuth 2.0 application. Make sure you use HTTP or HTTPS in your URL.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='callbackUrls'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.callbackUrls'
                                    defaultMessage='Callback URLs (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <textarea
                                    id='callbackUrls'
                                    rows='3'
                                    maxLength='1024'
                                    className='form-control'
                                    value={this.state.callbackUrls}
                                    onChange={this.updateCallbackUrls}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.callbackUrls.help'
                                        defaultMessage='The redirect URIs to which the service will redirect users after accepting or denying authorization of your application, and which will handle authorization codes or access tokens. Must be a valid URL and start with http:// or https://.'
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
                                className='btn btn-link btn-sm'
                                to={`/${this.props.team.name}/integrations/oauth2-apps`}
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
                                spinningText={localizeMessage(this.props.loading.id, this.props.loading.defaultMessage)}
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
