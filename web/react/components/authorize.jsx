// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    accountDescription1: {
        id: 'authorize.accountDescription1',
        defaultMessage: 'An application would like to connect to your '
    },
    accountDescription2: {
        id: 'authorize.accountDescription2',
        defaultMessage: ' account'
    },
    theApp: {
        id: 'authorize.theApp',
        defaultMessage: 'The app '
    },
    appAccess: {
        id: 'authorize.appAccess',
        defaultMessage: ' would like the ability to access and modify your basic information.'
    },
    allowAccess: {
        id: 'authorize.allowAccess',
        defaultMessage: 'Allow access to '
    },
    allow: {
        id: 'authorize.allow',
        defaultMessage: 'Allow'
    },
    deny: {
        id: 'authorize.deny',
        defaultMessage: 'Deny'
    }
});

class Authorize extends React.Component {
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
        const {formatMessage} = this.props.intl;
        var accountDescription = formatMessage(messages.accountDescription1) + this.props.teamName + formatMessage(messages.accountDescription2);
        if (this.props.intl.locale === 'es') {
            accountDescription = formatMessage(messages.accountDescription1) + formatMessage(messages.accountDescription2) + this.props.teamName;
        }
        return (
            <div className='authorize-box'>
                <div className='authorize-inner'>
                    <h3>{accountDescription}</h3>
                    <label>{formatMessage(messages.theApp) + this.props.appName + formatMessage(messages.appAccess)}</label>
                    <br/>
                    <br/>
                    <label>{formatMessage(messages.allowAccess) + this.props.appName + '?'}</label>
                    <br/>
                    <button
                        type='submit'
                        className='btn authorize-btn'
                        onClick={this.handleDeny}
                    >
                        {formatMessage(messages.deny)}
                    </button>
                    <button
                        type='submit'
                        className='btn btn-primary authorize-btn'
                        onClick={this.handleAllow}
                    >
                        {formatMessage(messages.allow)}
                    </button>
                </div>
            </div>
        );
    }
}

Authorize.propTypes = {
    intl: intlShape.isRequired,
    appName: React.PropTypes.string,
    teamName: React.PropTypes.string,
    responseType: React.PropTypes.string,
    clientId: React.PropTypes.string,
    redirectUri: React.PropTypes.string,
    state: React.PropTypes.string,
    scope: React.PropTypes.string
};

export default injectIntl(Authorize);