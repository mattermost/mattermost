// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';

const messages = defineMessages({
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
    },
    signin: {
        id: 'login_ldap.signin',
        defaultMessage: 'Sign in'
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
            state.serverError = formatMessage(messages.badTeam);
            this.setState(state);
            return;
        }

        const id = this.refs.id.value.trim();
        if (!id) {
            state.serverError = formatMessage(messages.idReq);
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = formatMessage(messages.pwdReq);
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
        const {formatMessage} = this.props.intl;
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

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
                            placeholder={formatMessage(messages.username)}
                            spellCheck='false'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            type='password'
                            className='form-control'
                            ref='password'
                            placeholder={formatMessage(messages.pwd)}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {formatMessage(messages.signin)}
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
    teamName: React.PropTypes.string.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(LoginLdap);