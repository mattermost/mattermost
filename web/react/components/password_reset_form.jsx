// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const holders = defineMessages({
    error: {
        id: 'password_form.error',
        defaultMessage: 'Please enter at least {chars} characters.'
    },
    update: {
        id: 'password_form.update',
        defaultMessage: 'Your password has been updated successfully.'
    },
    pwd: {
        id: 'password_form.pwd',
        defaultMessage: 'Password'
    }
});

class PasswordResetForm extends React.Component {
    constructor(props) {
        super(props);

        this.handlePasswordReset = this.handlePasswordReset.bind(this);

        this.state = {};
    }
    handlePasswordReset(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < Constants.MIN_PASSWORD_LENGTH) {
            state.error = formatMessage(holders.error, {chars: Constants.MIN_PASSWORD_LENGTH});
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var data = {};
        data.new_password = password;
        data.hash = this.props.hash;
        data.data = this.props.data;
        data.name = this.props.teamName;

        Client.resetPassword(data,
            function resetSuccess() {
                this.setState({error: null, updateText: formatMessage(holders.update)});
            }.bind(this),
            function resetFailure(err) {
                this.setState({error: err.message, updateText: null});
            }.bind(this)
        );
    }
    render() {
        var updateText = null;
        if (this.state.updateText) {
            updateText = (<div className='form-group'><br/><label className='control-label reset-form'>{this.state.updateText}
                <FormattedHTMLMessage
                    id='password_form.click'
                    defaultMessage='Click <a href={url}>here</a> to log in.'
                    values={{
                        url: '/' + this.props.teamName + '/login'
                    }}
                />
                </label></div>);
        }

        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        const {formatMessage} = this.props.intl;
        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>
                        <FormattedMessage
                            id='password_form.title'
                            defaultMessage='Password Reset'
                        />
                    </h3>
                    <form onSubmit={this.handlePasswordReset}>
                        <p>
                            <FormattedMessage
                                id='password_form.enter'
                                defaultMessage='Enter a new password for your {teamDisplayName} {siteName} account.'
                                values={{
                                    teamDisplayName: this.props.teamDisplayName,
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                        </p>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='password'
                                ref='password'
                                placeholder={formatMessage(holders.pwd)}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='password_form.change'
                                defaultMessage='Change my password'
                            />
                        </button>
                        {updateText}
                    </form>
                </div>
            </div>
        );
    }
}

PasswordResetForm.defaultProps = {
    teamName: '',
    teamDisplayName: '',
    hash: '',
    data: ''
};
PasswordResetForm.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    hash: React.PropTypes.string,
    data: React.PropTypes.string
};

export default injectIntl(PasswordResetForm);