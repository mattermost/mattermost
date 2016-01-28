// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    pwdError: {
        id: 'claim.email_to_sso.pwdError',
        defaultMessage: 'Please enter your password.'
    },
    pwd: {
        id: 'claim.email_to_sso.pwd',
        defaultMessage: 'Password'
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
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.error = this.props.intl.formatMessage(holders.pwdError);
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
                    <h3>
                        <FormattedMessage
                            id='claim.email_to_sso.title'
                            defaultMessage='Switch Email/Password Account to {uiType}'
                            values={{
                                uiType: uiType
                            }}
                        />
                    </h3>
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
                                placeholder={this.props.intl.formatMessage(holders.pwd)}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='claim.email_to_sso.switchTo'
                                defaultMessage='Switch account to {uiType}'
                                values={{
                                    uiType: uiType
                                }}
                            />
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
    intl: intlShape.isRequired,
    type: React.PropTypes.string.isRequired,
    email: React.PropTypes.string.isRequired,
    teamName: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired
};

export default injectIntl(EmailToSSO);