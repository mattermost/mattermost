// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as OAuthActions from 'actions/oauth_actions.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageHeader from './backstage_header.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {browserHistory, Link} from 'react-router';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AddOAuthApp extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateName = this.updateName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateHomepage = this.updateHomepage.bind(this);
        this.updateCallbackUrls = this.updateCallbackUrls.bind(this);

        this.state = {
            name: '',
            description: '',
            homepage: '',
            callbackUrls: '',
            saving: false,
            serverError: '',
            clientError: null
        };
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
                        defaultMessage='The name for the OAuth App is required'
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
                        defaultMessage='The description for the OAuth App is required'
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
                        defaultMessage='The homepage for the OAuth App is required'
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
                        defaultMessage='One or more callback URLs are required'
                    />
                )
            });

            return;
        }

        const app = {
            name: this.state.name,
            callback_urls: callbackUrls,
            homepage: this.state.homepage,
            description: this.state.description
        };

        OAuthActions.registerOAuthApp(
            app,
            () => {
                browserHistory.push('/' + Utils.getTeamNameFromUrl() + '/settings/integrations/oauth-apps');
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

    updateCallbackUrls(e) {
        this.setState({
            callbackUrls: e.target.value
        });
    }

    render() {
        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/oauth-apps'}>
                        <FormattedMessage
                            id='installed_oauth_apps.header'
                            defaultMessage='OAuth Apps'
                        />
                    </Link>
                    <FormattedMessage
                        id='add_oauth_app.header'
                        defaultMessage='Add'
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
                                    maxLength='128'
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
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
                                    type='text'
                                    maxLength='128'
                                    className='form-control'
                                    value={this.state.homepage}
                                    onChange={this.updateHomepage}
                                />
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
                                    maxLength='1000'
                                    className='form-control'
                                    value={this.state.callbackUrls}
                                    onChange={this.updateCallbackUrls}
                                />
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError errors={[this.state.serverError, this.state.clientError]}/>
                            <Link
                                className='btn btn-sm'
                                to={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/oauth-apps'}
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
