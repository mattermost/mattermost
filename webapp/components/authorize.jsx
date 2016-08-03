// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';

import icon50 from 'images/icon50x50.png';

export default class Authorize extends React.Component {
    static get propTypes() {
        return {
            location: React.PropTypes.object.isRequired,
            params: React.PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleAllow = this.handleAllow.bind(this);
        this.handleDeny = this.handleDeny.bind(this);

        this.state = {};
    }

    componentWillMount() {
        Client.getOAuthAppInfo(
            this.props.location.query.client_id,
            (app) => {
                this.setState({app});
            }
        );
    }

    componentDidMount() {
        // if we get to this point remove the antiClickjack blocker
        const blocker = document.getElementById('antiClickjack');
        if (blocker) {
            blocker.parentNode.removeChild(blocker);
        }
    }

    handleAllow() {
        const params = this.props.location.query;

        Client.allowOAuth2(params.response_type, params.client_id, params.redirect_uri, params.state, params.scope,
            (data) => {
                if (data.redirect) {
                    window.location.href = data.redirect;
                }
            },
            () => {
                //Do nothing on error
            }
        );
    }

    handleDeny() {
        window.location.replace(this.props.location.query.redirect_uri + '?error=access_denied');
    }

    render() {
        const app = this.state.app;
        if (!app) {
            return null;
        }

        let icon;
        if (app.icon_url) {
            icon = app.icon_url;
        } else {
            icon = icon50;
        }

        return (
            <div className='container-fluid'>
                <div className='prompt'>
                    <div className='prompt__heading'>
                        <div className='prompt__app-icon'>
                            <img
                                src={icon}
                                width='50'
                                height='50'
                                alt=''
                            />
                        </div>
                        <div className='text'>
                            <FormattedHTMLMessage
                                id='authorize.title'
                                defaultMessage='<strong>{appName}</strong> would like to connect to your <strong>Mattermost</strong> user account'
                                values={{
                                    appName: app.name
                                }}
                            />
                        </div>
                    </div>
                    <p>
                        <FormattedHTMLMessage
                            id='authorize.app'
                            defaultMessage='The app <strong>{appName}</strong> would like the ability to access and modify your basic information.'
                            values={{
                                appName: app.name
                            }}
                        />
                    </p>
                    <h2 className='prompt__allow'>
                        <FormattedHTMLMessage
                            id='authorize.access'
                            defaultMessage='Allow <strong>{appName}</strong> access?'
                            values={{
                                appName: app.name
                            }}
                        />
                    </h2>
                    <div className='prompt__buttons'>
                        <button
                            type='submit'
                            className='btn btn-link authorize-btn'
                            onClick={this.handleDeny}
                        >
                            <FormattedMessage
                                id='authorize.deny'
                                defaultMessage='Deny'
                            />
                        </button>
                        <button
                            type='submit'
                            className='btn btn-primary authorize-btn'
                            onClick={this.handleAllow}
                        >
                            <FormattedMessage
                                id='authorize.allow'
                                defaultMessage='Allow'
                            />
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
