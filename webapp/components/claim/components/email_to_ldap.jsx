// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import * as Client from 'utils/client.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

export default class EmailToLDAP extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        e.preventDefault();
        var state = {};

        const password = ReactDOM.findDOMNode(this.refs.emailpassword).value.trim();
        if (!password) {
            state.error = Utils.localizeMessage('claim.email_to_ldap.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        const ldapId = ReactDOM.findDOMNode(this.refs.ldapid).value.trim();
        if (!ldapId) {
            state.error = Utils.localizeMessage('claim.email_to_ldap.ldapIdError', 'Please enter your LDAP ID.');
            this.setState(state);
            return;
        }

        const ldapPassword = ReactDOM.findDOMNode(this.refs.ldappassword).value.trim();
        if (!ldapPassword) {
            state.error = Utils.localizeMessage('claim.email_to_ldap.ldapPasswordError', 'Please enter your LDAP password.');
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var postData = {};
        postData.email_password = password;
        postData.ldap_id = ldapId;
        postData.ldap_password = ldapPassword;
        postData.email = this.props.email;
        postData.team_name = this.props.teamName;

        Client.emailToLDAP(postData,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (error) => {
                this.setState({error});
            }
        );
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.email_to_ldap.title'
                        defaultMessage='Switch Email/Password Account to LDAP'
                    />
                </h3>
                <form onSubmit={this.submit}>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.ssoType'
                            defaultMessage='Upon claiming your account, you will only be able to login with LDAP'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.ssoNote'
                            defaultMessage='You must already have a valid LDAP account'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.enterPwd'
                            defaultMessage='Enter the password for your {team} {site} email account'
                            values={{
                                team: this.props.teamDisplayName,
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <input
                        type='text'
                        style={{display: 'none'}}
                        name='fakeusernameremembered'
                    />
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='emailPassword'
                            ref='emailpassword'
                            autoComplete='off'
                            placeholder={Utils.localizeMessage('claim.email_to_ldap.emailPwd', 'Email Password')}
                            spellCheck='false'
                        />
                    </div>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.enterLdapPwd'
                            defaultMessage='Enter the ID and password for your LDAP account'
                            values={{
                                team: this.props.teamDisplayName,
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <div className={formClass}>
                        <input
                            type='text'
                            className='form-control'
                            name='ldapId'
                            ref='ldapid'
                            autoComplete='off'
                            placeholder={Utils.localizeMessage('claim.email_to_ldap.ldapId', 'LDAP ID')}
                            spellCheck='false'
                        />
                    </div>
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='ldapPassword'
                            ref='ldappassword'
                            autoComplete='off'
                            placeholder={Utils.localizeMessage('claim.email_to_ldap.ldapPwd', 'LDAP Password')}
                            spellCheck='false'
                        />
                    </div>
                    {error}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.email_to_ldap.switchTo'
                            defaultMessage='Switch account to LDAP'
                        />
                    </button>
                </form>
            </div>
        );
    }
}

EmailToLDAP.defaultProps = {
};
EmailToLDAP.propTypes = {
    email: React.PropTypes.string,
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};
