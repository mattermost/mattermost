// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

const messages = defineMessages({
    pwdError: {
        id: 'claim.email_to_sso.pwdError',
        defaultMessage: 'Please enter your password.'
    },
    title: {
        id: 'claim.email_to_sso.title',
        defaultMessage: 'Switch Email/Password Account to '
    },
    pwd: {
        id: 'claim.email_to_sso.pwd',
        defaultMessage: 'Password'
    },
    switchTo: {
        id: 'claim.email_to_sso.switchTo',
        defaultMessage: 'Switch account to '
    }
});

class EmailToSSO extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.error = formatMessage(messages.pwdError);
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var postData = {};
        postData.password = password;
        postData.email = this.props.email;
        postData.team_name = this.props.teamName;
        postData.service = this.props.type;

        Client.switchToSSO(postData,
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

        const uiType = Utils.toTitleCase(this.props.type) + ' SSO';

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{formatMessage(messages.title) + uiType}</h3>
                    <form onSubmit={this.submit}>
                        <p>
                            <FormattedMessage
                                id='claim.email_to_sso.ssoType'
                                defaultMessage='Upon claiming your account, you will only be able to login with {type} SSO'
                                values={{
                                    type: Utils.toTitleCase(this.props.type)
                                }}
                            />
                        </p>
                        <p>
                            <FormattedMessage
                                id='claim.email_to_sso.enterPwd'
                                defaultMessage='Enter the password for your {team} {site} account'
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
                                placeholder={formatMessage(messages.pwd)}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {formatMessage(messages.switchTo) + uiType}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

EmailToSSO.defaultProps = {
};
EmailToSSO.propTypes = {
    type: React.PropTypes.string.isRequired,
    email: React.PropTypes.string.isRequired,
    teamName: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(EmailToSSO);