// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';

import icon50 from 'images/icon50x50.png';

export default class Authorize extends React.Component {
    constructor(props) {
        super(props);

        this.handleAllow = this.handleAllow.bind(this);
        this.handleDeny = this.handleDeny.bind(this);

        this.state = {};
    }
    handleAllow() {
        const responseType = this.props.responseType;
        const clientId = this.props.clientId;
        const redirectUri = this.props.redirectUri;
        const state = this.props.state;
        const scope = this.props.scope;

        Client.allowOAuth2(responseType, clientId, redirectUri, state, scope,
            (data) => {
                if (data.redirect) {
                    window.location.replace(data.redirect);
                }
            },
            () => {
                //Do nothing on error
            }
        );
    }
    handleDeny() {
        window.location.replace(this.props.redirectUri + '?error=access_denied');
    }
    render() {
        return (
            <div className='container-fluid'>
                <div className='prompt'>
                    <div className='prompt__heading'>
                        <div className='prompt__app-icon'>
                            <img
                                src={icon50}
                                width='50'
                                height='50'
                                alt=''
                            />
                        </div>
                        <div className='text'>
                            <FormattedMessage
                                id='authorize.title'
                                defaultMessage='An application would like to connect to your {teamName} account'
                                values={{
                                    teamName: this.props.teamName
                                }}
                            />
                        </div>
                    </div>
                    <p>
                        <FormattedHTMLMessage
                            id='authorize.app'
                            defaultMessage='The app <strong>{appName}</strong> would like the ability to access and modify your basic information.'
                            values={{
                                appName: this.props.appName
                            }}
                        />
                    </p>
                    <h2 className='prompt__allow'>
                        <FormattedHTMLMessage
                            id='authorize.access'
                            defaultMessage='Allow <strong>{appName}</strong> access?'
                            values={{
                                appName: this.props.appName
                            }}
                        />
                    </h2>
                    <div className='prompt__buttons'>
                        <button
                            type='submit'
                            className='btn authorize-btn'
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

Authorize.propTypes = {
    appName: React.PropTypes.string,
    teamName: React.PropTypes.string,
    responseType: React.PropTypes.string,
    clientId: React.PropTypes.string,
    redirectUri: React.PropTypes.string,
    state: React.PropTypes.string,
    scope: React.PropTypes.string
};
