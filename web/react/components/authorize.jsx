// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';

import {FormattedMessage} from 'mm-intl';

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
            () => {}
        );
    }
    handleDeny() {
        window.location.replace(this.props.redirectUri + '?error=access_denied');
    }
    render() {
        return (
            <div className='authorize-box'>
                <div className='authorize-inner'>
                    <h3>
                        <FormattedMessage
                            id='authorize.title'
                            defaultMessage='An application would like to connect to your {teamName} account'
                            values={{
                                teamName: this.props.teamName
                            }}
                        />
                    </h3>
                    <label>
                        <FormattedMessage
                            id='authorize.app'
                            defaultMessage='The app {appName} would like the ability to access and modify your basic information.'
                            values={{
                                appName: this.props.appName
                            }}
                        />
                    </label>
                    <br/>
                    <br/>
                    <label>
                        <FormattedMessage
                            id='authorize.access'
                            defaultMessage='Allow {appName} access?'
                            values={{
                                appName: this.props.appName
                            }}
                        />
                    </label>
                    <br/>
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
