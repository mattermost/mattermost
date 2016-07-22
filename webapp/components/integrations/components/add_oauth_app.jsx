// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as OAuthActions from 'actions/oauth_actions.jsx';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {browserHistory, Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AddOAuthApp extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateName = this.updateName.bind(this);
        this.updateTrusted = this.updateTrusted.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateHomepage = this.updateHomepage.bind(this);
        this.updateIconUrl = this.updateIconUrl.bind(this);
        this.updateCallbackUrls = this.updateCallbackUrls.bind(this);

        this.imageLoaded = this.imageLoaded.bind(this);
        this.image = new Image();
        this.image.onload = this.imageLoaded;

        this.state = {
            name: '',
            description: '',
            homepage: '',
            icon_url: '',
            callbackUrls: '',
            is_trusted: false,
            has_icon: false,
            saving: false,
            serverError: '',
            clientError: null
        };
    }

    imageLoaded() {
        this.setState({
            has_icon: true,
            icon_url: this.refs.icon_url.value
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            serverError: '',
            clientError: ''
        });

        if (!this.state.name) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.nameRequired'
                        defaultMessage='Name for the OAuth 2.0 application is required.'
                    />
                )
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
                )
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
                )
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
                )
            });

            return;
        }

        const app = {
            name: this.state.name,
            callback_urls: callbackUrls,
            homepage: this.state.homepage,
            description: this.state.description,
            is_trusted: this.state.is_trusted,
            icon_url: this.state.icon_url
        };

        OAuthActions.registerOAuthApp(
            app,
            () => {
                browserHistory.push('/' + this.props.team.name + '/integrations/oauth2-apps');
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    updateName(e) {
        this.setState({
            name: e.target.value
        });
    }

    updateTrusted(e) {
        this.setState({
            is_trusted: e.target.value === 'true'
        });
    }

    updateDescription(e) {
        this.setState({
            description: e.target.value
        });
    }

    updateHomepage(e) {
        this.setState({
            homepage: e.target.value
        });
    }

    updateIconUrl(e) {
        this.setState({
            has_icon: false,
            icon_url: ''
        });
        this.image.src = e.target.value;
    }

    updateCallbackUrls(e) {
        this.setState({
            callbackUrls: e.target.value
        });
    }

    render() {
        let icon;
        if (this.state.has_icon) {
            icon = (
                <div className='integration__icon'>
                    <img src={this.state.icon_url}/>
                </div>
            );
        }

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/integrations/oauth2-apps'}>
                        <FormattedMessage
                            id='installed_oauth_apps.header'
                            defaultMessage='Installed OAuth2 Apps'
                        />
                    </Link>
                    <FormattedMessage
                        id='add_oauth_app.header'
                        defaultMessage='Add'
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    {icon}
                    <form className='form-horizontal'>
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
                                        defaultMessage="When true, the OAuth 2.0 application is considered trusted by the Mattermost server and doesn't require the user to accept authorization. When false, an additional window will appear, asking the user to accept or deny the authorization."
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='name'
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.name'
                                    defaultMessage='Name'
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
                                        defaultMessage='Choose a name for your OAuth 2.0 application made of up to 64 characters.'
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
                                        defaultMessage='Provide a description for your application.'
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
                                        defaultMessage='The URL for the homepage of the OAuth 2.0 application. Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
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
                                    ref='icon_url'
                                    type='url'
                                    maxLength='512'
                                    className='form-control'
                                    onChange={this.updateIconUrl}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_oauth_app.icon.help'
                                        defaultMessage='The URL for the homepage of the OAuth 2.0 application. Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
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
                                errors={[this.state.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-sm'
                                to={'/' + this.props.team.name + '/integrations/oauth2-apps'}
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
                                onClick={this.handleSubmit}
                            >
                                <FormattedMessage
                                    id='installed_oauth_apps.save'
                                    defaultMessage='Save'
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
