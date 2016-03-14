// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    enterPwd: {
        id: 'claim.sso_to_email.enterPwd',
        defaultMessage: 'Please enter a password.'
    },
    pwdNotMatch: {
        id: 'claim.sso_to_email.pwdNotMatch',
        defaultMessage: 'Password do not match.'
    },
    newPwd: {
        id: 'claim.sso_to_email.newPwd',
        defaultMessage: 'New Password'
    },
    confirm: {
        id: 'claim.sso_to_email.confirm',
        defaultMessage: 'Confirm Password'
    }
});

class SSOToEmail extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        const {formatMessage} = this.props.intl;
        e.preventDefault();
        const state = {};

        const password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.error = formatMessage(holders.enterPwd);
            this.setState(state);
            return;
        }

        const confirmPassword = ReactDOM.findDOMNode(this.refs.passwordconfirm).value.trim();
        if (!confirmPassword || password !== confirmPassword) {
            state.error = formatMessage(holders.pwdNotMatch);
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var postData = {};
        postData.password = password;
        postData.email = this.props.email;
        postData.team_name = this.props.teamName;

        Client.switchToEmail(postData,
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
        const {formatMessage} = this.props.intl;
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        const uiType = Utils.toTitleCase(this.props.currentType) + ' SSO';

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.sso_to_email.title'
                        defaultMessage='Switch {type} Account to Email'
                        values={{
                            type: uiType
                        }}
                    />
                </h3>
                <form onSubmit={this.submit}>
                    <p>
                        <FormattedMessage
                            id='claim.sso_to_email.description'
                            defaultMessage='Upon changing your account type, you will only be able to login with your email and password.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.sso_to_email_newPwd'
                            defaultMessage='Enter a new password for your {team} {site} account'
                            values={{
                                team: this.props.teamDisplayName,
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder={formatMessage(holders.newPwd)}
                            spellCheck='false'
                        />
                    </div>
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='passwordconfirm'
                            ref='passwordconfirm'
                            placeholder={formatMessage(holders.confirm)}
                            spellCheck='false'
                        />
                    </div>
                    {error}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.sso_to_email.switchTo'
                            defaultMessage='Switch {type} to email and password'
                            values={{
                                type: uiType
                            }}
                        />
                    </button>
                </form>
            </div>
        );
    }
}

SSOToEmail.defaultProps = {
};
SSOToEmail.propTypes = {
    intl: intlShape.isRequired,
    currentType: React.PropTypes.string.isRequired,
    email: React.PropTypes.string.isRequired,
    teamName: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string
};

export default injectIntl(SSOToEmail);
