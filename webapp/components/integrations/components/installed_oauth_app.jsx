// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import FormError from 'components/form_error.jsx';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const FAKE_SECRET = '***************';

export default class InstalledOAuthApp extends React.Component {
    static get propTypes() {
        return {
            oauthApp: React.PropTypes.object.isRequired,
            onDelete: React.PropTypes.func.isRequired,
            filter: React.PropTypes.string
        };
    }

    constructor(props) {
        super(props);

        this.handleShowClientSecret = this.handleShowClientSecret.bind(this);
        this.handleHideClientScret = this.handleHideClientScret.bind(this);
        this.handleRegenerate = this.handleRegenerate.bind(this);
        this.handleDelete = this.handleDelete.bind(this);

        this.matchesFilter = this.matchesFilter.bind(this);

        this.state = {
            clientSecret: FAKE_SECRET
        };
    }

    handleShowClientSecret(e) {
        e.preventDefault();
        this.setState({clientSecret: this.props.oauthApp.client_secret});
    }

    handleHideClientScret(e) {
        e.preventDefault();
        this.setState({clientSecret: FAKE_SECRET});
    }

    handleRegenerate(e) {
        e.preventDefault();

        Client.regenerateOAuthAppSecret(
            this.props.oauthApp.id,
            (data) => {
                this.props.oauthApp.client_secret = data.client_secret;
                this.handleShowClientSecret(e);
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }

    handleDelete(e) {
        e.preventDefault();

        this.props.onDelete(this.props.oauthApp);
    }

    matchesFilter(oauthApp, filter) {
        if (!filter) {
            return true;
        }

        return oauthApp.name.toLowerCase().indexOf(filter) !== -1;
    }

    render() {
        const oauthApp = this.props.oauthApp;
        let error;

        if (this.state.error) {
            error = (
                <FormError
                    error={this.state.error}
                />
            );
        }

        if (!this.matchesFilter(oauthApp, this.props.filter)) {
            return null;
        }

        let name;
        if (oauthApp.name) {
            name = oauthApp.name;
        } else {
            name = (
                <FormattedMessage
                    id='installed_integrations.unnamed_oauth_app'
                    defaultMessage='Unnamed OAuth 2.0 Application'
                />
            );
        }

        let description;
        if (oauthApp.description) {
            description = (
                <div className='item-details__row'>
                    <span className='item-details__description'>
                        {oauthApp.description}
                    </span>
                </div>
            );
        }

        const urls = (
            <div className='item-details__row'>
                <span className='item-details__url'>
                    <FormattedMessage
                        id='installed_integrations.callback_urls'
                        defaultMessage='Callback URLs: {urls}'
                        values={{
                            urls: oauthApp.callback_urls.join(', ')
                        }}
                    />
                </span>
            </div>
        );

        let isTrusted;
        if (oauthApp.is_trusted) {
            isTrusted = Utils.localizeMessage('installed_oauth_apps.trusted.yes', 'Yes');
        } else {
            isTrusted = Utils.localizeMessage('installed_oauth_apps.trusted.no', 'No');
        }

        let showHide;
        if (this.state.clientSecret === FAKE_SECRET) {
            showHide = (
                <a
                    href='#'
                    onClick={this.handleShowClientSecret}
                >
                    <FormattedMessage
                        id='installed_integrations.showSecret'
                        defaultMessage='Show Secret'
                    />
                </a>
            );
        } else {
            showHide = (
                <a
                    href='#'
                    onClick={this.handleHideClientScret}
                >
                    <FormattedMessage
                        id='installed_integrations.hideSecret'
                        defaultMessage='Hide Secret'
                    />
                </a>
            );
        }

        const regen = (
            <a
                href='#'
                onClick={this.handleRegenerate}
            >
                <FormattedMessage
                    id='installed_integrations.regenSecret'
                    defaultMessage='Regenerate Secret'
                />
            </a>
        );

        let icon;
        if (oauthApp.icon_url) {
            icon = (
                <div className='integration__icon integration-list__icon'>
                    <img src={oauthApp.icon_url}/>
                </div>
            );
        }

        return (
            <div className='backstage-list__item'>
                {icon}
                <div className='item-details'>
                    <div className='item-details__row'>
                        <span className='item-details__name'>
                            {name}
                        </span>
                    </div>
                    {error}
                    {description}
                    <div className='item-details__row'>
                        <span className='item-details__url'>
                            <FormattedHTMLMessage
                                id='installed_oauth_apps.is_trusted'
                                defaultMessage='Is Trusted: <strong>{isTrusted}</strong>'
                                values={{
                                    isTrusted
                                }}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedHTMLMessage
                                id='installed_integrations.client_id'
                                defaultMessage='Client ID: <strong>{clientId}</strong>'
                                values={{
                                    clientId: oauthApp.id
                                }}
                            />
                        </span>
                    </div>
                    <div className='item-details__row'>
                        <span className='item-details__token'>
                            <FormattedHTMLMessage
                                id='installed_integrations.client_secret'
                                defaultMessage='Client Secret: <strong>{clientSecret}</strong>'
                                values={{
                                    clientSecret: this.state.clientSecret
                                }}
                            />
                        </span>
                    </div>
                    {urls}
                    <div className='item-details__row'>
                        <span className='item-details__creation'>
                            <FormattedMessage
                                id='installed_integrations.creation'
                                defaultMessage='Created by {creator} on {createAt, date, full}'
                                values={{
                                    creator: Utils.displayUsername(oauthApp.creator_id),
                                    createAt: oauthApp.create_at
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div className='item-actions'>
                    {showHide}
                    {' - '}
                    {regen}
                    {' - '}
                    <a
                        href='#'
                        onClick={this.handleDelete}
                    >
                        <FormattedMessage
                            id='installed_integrations.delete'
                            defaultMessage='Delete'
                        />
                    </a>
                </div>
            </div>
        );
    }
}
