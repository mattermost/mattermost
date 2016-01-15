// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as client from '../utils/client.jsx';

const messages = defineMessages({
    error: {
        id: 'password_form.error',
        defaultMessage: 'Please enter at least 5 characters.'
    },
    update: {
        id: 'password_form.update',
        defaultMessage: 'Your password has been updated successfully.'
    },
    click: {
        id: 'password_form.click',
        defaultMessage: ' Click '
    },
    here: {
        id: 'password_form.here',
        defaultMessage: 'here'
    },
    toLogin: {
        id: 'password_form.toLogin',
        defaultMessage: ' to log in.'
    },
    enter: {
        id: 'password_form.enter',
        defaultMessage: 'Enter a new password for your '
    },
    account: {
        id: 'password_form.account',
        defaultMessage: ' account.'
    },
    title: {
        id: 'password_form.title',
        defaultMessage: 'Password Reset'
    },
    pwd: {
        id: 'password_form.pwd',
        defaultMessage: 'Password'
    },
    change: {
        id: 'password_form.change',
        defaultMessage: 'Change my password'
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
        if (!password || password.length < 5) {
            state.error = formatMessage(messages.error);
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

        client.resetPassword(data,
            function resetSuccess() {
                this.setState({error: null, updateText: formatMessage(messages.update)});
            }.bind(this),
            function resetFailure(err) {
                this.setState({error: err.message, updateText: null});
            }.bind(this)
        );
    }
    render() {
        const {formatMessage, locale} = this.props.intl;

        var updateText = null;
        if (this.state.updateText) {
            updateText = <div className='form-group'><br/><label className='control-label reset-form'>{this.state.updateText + formatMessage(messages.click)}<a href={'/' + this.props.teamName + '/login'}>{formatMessage(messages.here)}</a>{formatMessage(messages.toLogin)}</label></div>;
        }

        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        let msg = formatMessage(messages.enter) + this.props.teamDisplayName + ' ' + global.window.mm_config.SiteName + formatMessage(messages.account);
        if (locale === 'es') {
            msg = formatMessage(messages.enter) + formatMessage(messages.account) + this.props.teamDisplayName + ' ' + global.window.mm_config.SiteName;
        }
        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{formatMessage(messages.title)}</h3>
                    <form onSubmit={this.handlePasswordReset}>
                        <p>{msg}</p>
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
                            {formatMessage(messages.change)}
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