// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    team_error: {
        id: 'ldap_signup.team_error',
        defaultMessage: 'Please enter a team name'
    },
    length_error: {
        id: 'ldap_signup.length_error',
        defaultMessage: 'Name must be 3 or more characters up to a maximum of 15'
    },
    teamName: {
        id: 'ldap_signup.teamName',
        defaultMessage: 'Enter name of new team'
    },
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

class LdapSignUpPage extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.valueChange = this.valueChange.bind(this);

        this.state = {name: '', id: '', password: ''};
    }

    handleSubmit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var teamSignup = {};
        teamSignup.user = {};
        teamSignup.team = {};
        var state = this.state;
        state.serverError = null;

        teamSignup.team.display_name = this.state.name;

        if (!teamSignup.team.display_name) {
            state.serverError = formatMessage(holders.team_error);
            this.setState(state);
            return;
        }

        if (teamSignup.team.display_name.length <= 2) {
            state.serverError = formatMessage(holders.length_error);
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

        teamSignup.team.name = utils.cleanUpUrlable(teamSignup.team.display_name);
        teamSignup.team.type = 'O';

        teamSignup.user.username = ReactDOM.findDOMNode(this.refs.id).value.trim();
        teamSignup.user.password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        teamSignup.user.allow_marketing = true;
        teamSignup.user.ldap = true;
        teamSignup.user.auth_service = 'ldap';

        $('#ldap-button').button('loading');

        Client.createTeamWithLdap(teamSignup,
            () => {
                Client.track('signup', 'signup_team_ldap_complete');

                Client.loginByLdap(teamSignup.team.name, id, password,
                    () => {
                        window.location.href = '/' + teamSignup.team.name + '/channels/town-square';
                    },
                    (err) => {
                        $('#ldap-button').button('reset');
                        this.setState({serverError: err.message});
                    }
                );
            },
            (err) => {
                $('#ldap-button').button('reset');
                this.setState({serverError: err.message});
            }
        );
    }

    valueChange() {
        this.setState({
            name: ReactDOM.findDOMNode(this.refs.teamname).value.trim(),
            id: ReactDOM.findDOMNode(this.refs.id).value.trim(),
            password: ReactDOM.findDOMNode(this.refs.password).value.trim()
        });
    }

    render() {
        const {formatMessage} = this.props.intl;
        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var disabled = false;
        if (this.state.name.length <= 2) {
            disabled = true;
        }

        if (this.state.id.length <= 1) {
            disabled = true;
        }

        if (this.state.password.length <= 1) {
            disabled = true;
        }

        return (
            <form
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className={nameDivClass}>
                    <input
                        autoFocus={true}
                        type='text'
                        ref='teamname'
                        className='form-control'
                        placeholder={this.props.intl.formatMessage(holders.teamName)}
                        maxLength='128'
                        onChange={this.valueChange}
                        spellCheck='false'
                    />
                    {nameError}
                </div>
                <div className={nameDivClass}>
                    <input
                        className='form-control'
                        ref='id'
                        placeholder={formatMessage(holders.username)}
                        spellCheck='false'
                        onChange={this.valueChange}
                    />
                </div>
                <div className={nameDivClass}>
                    <input
                        type='password'
                        className='form-control'
                        ref='password'
                        placeholder={formatMessage(holders.pwd)}
                        spellCheck='false'
                        onChange={this.valueChange}
                    />
                </div>
                <div className='form-group'>
                    <a
                        className='btn btn-custom-login ldap btn-full'
                        key='ldap'
                        id='ldap-button'
                        href='#'
                        onClick={this.handleSubmit}
                        disabled={disabled}
                    >
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='ldap_signup.ldap'
                                defaultMessage='Create team with LDAP Account'
                            />
                        </span>
                    </a>
                    {serverError}
                </div>
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>
                        <FormattedMessage
                            id='ldap_signup.find'
                            defaultMessage='Find my teams'
                        />
                    </a></span>
                </div>
            </form>
        );
    }
}

LdapSignUpPage.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(LdapSignUpPage);