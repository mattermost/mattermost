// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    badTeam: {
        id: 'login_ldap.badTeam',
        defaultMessage: 'Bad team name'
    },
    idReq: {
        id: 'login_ldap.idlReq',
        defaultMessage: 'An LDAP ID is required'
    },
    pwdReq: {
        id: 'login_ldap.pwdReq',
        defaultMessage: 'An LDAP password is required'
    },
    username: {
        id: 'login_ldap.username',
        defaultMessage: 'LDAP Username'
    },
    pwd: {
        id: 'login_ldap.pwd',
        defaultMessage: 'LDAP Password'
    }
});

class LoginLdap extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            serverError: ''
        };
    }
    handleSubmit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var state = {};

        const teamName = this.props.teamName;
        if (!teamName) {
            state.serverError = formatMessage(holders.badTeam);
            this.setState(state);
            return;
        }

        const id = this.refs.id.value.trim();
        if (!id) {
            state.serverError = formatMessage(holders.idReq);
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = formatMessage(holders.pwdReq);
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        Client.loginByLdap(teamName, id, password,
            () => {
                const redirect = Utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + teamName + '/channels/town-square';
                }
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }
        const {formatMessage} = this.props.intl;
        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={true}
                            className='form-control'
                            ref='id'
                            placeholder={formatMessage(holders.username)}
                            spellCheck='false'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            type='password'
                            className='form-control'
                            ref='password'
                            placeholder={formatMessage(holders.pwd)}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_ldap.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginLdap.defaultProps = {
};

LoginLdap.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string.isRequired
};

export default injectIntl(LoginLdap);