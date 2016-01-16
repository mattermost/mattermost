// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';

const messages = defineMessages({
    error: {
        id: 'password_send.error',
        defaultMessage: 'Please enter a valid email address.'
    },
    checkInbox: {
        id: 'password_send.checkInbox',
        defaultMessage: 'Please check your inbox.'
    },
    link: {
        id: 'password_send.link',
        defaultMessage: 'A password reset link has been sent to '
    },
    for: {
        id: 'password_send.for',
        defaultMessage: ' for your '
    },
    team: {
        id: 'password_send.team',
        defaultMessage: ' team on '
    },
    title: {
        id: 'password_send.title',
        defaultMessage: 'Password Reset'
    },
    description: {
        id: 'password_send.description',
        defaultMessage: 'To reset your password, enter the email address you used to sign up for '
    },
    email: {
        id: 'password_send.email',
        defaultMessage: 'Email'
    },
    reset: {
        id: 'password_send.reset',
        defaultMessage: 'Reset my password'
    }
});

class PasswordResetSendLink extends React.Component {
    constructor(props) {
        super(props);

        this.handleSendLink = this.handleSendLink.bind(this);

        this.state = {};
    }
    handleSendLink(e) {
        e.preventDefault();

        const {formatMessage, locale} = this.props.intl;
        var state = {};

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            state.error = formatMessage(messages.error);
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var data = {};
        data.email = email;
        data.name = this.props.teamName;

        let updateText = <p>{formatMessage(messages.link)}<b>{email}</b>{formatMessage(messages.for)}<b>{this.props.teamDisplayName}</b>{formatMessage(messages.team) + window.location.hostname}.</p>;
        if (locale === 'es') {
            updateText = <p>{formatMessage(messages.link)}<b>{email}</b>{formatMessage(messages.for) + formatMessage(messages.team)}<b>{this.props.teamDisplayName}</b> en {window.location.hostname}.</p>;
        }

        client.sendPasswordReset(data,
             function passwordResetSent() {
                 this.setState({error: null, updateText: updateText, moreUpdateText: formatMessage(messages.checkInbox)});
                 $(ReactDOM.findDOMNode(this.refs.reset_form)).hide();
             }.bind(this),
             function passwordResetFailedToSend(err) {
                 this.setState({error: err.message, update_text: null, moreUpdateText: null});
             }.bind(this)
            );
    }
    render() {
        const {formatMessage} = this.props.intl;
        var updateText = null;
        if (this.state.updateText) {
            updateText = <div className='reset-form alert alert-success'>{this.state.updateText + this.state.moreUpdateText}</div>;
        }

        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{formatMessage(messages.title)}</h3>
                    {updateText}
                    <form
                        onSubmit={this.handleSendLink}
                        ref='reset_form'
                    >
                        <p>{formatMessage(messages.description) + this.props.teamDisplayName + '.'}</p>
                        <div className={formClass}>
                            <input
                                type='email'
                                className='form-control'
                                name='email'
                                ref='email'
                                placeholder={formatMessage(messages.email)}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {formatMessage(messages.reset)}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

PasswordResetSendLink.defaultProps = {
    teamName: '',
    teamDisplayName: ''
};
PasswordResetSendLink.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};

export default injectIntl(PasswordResetSendLink);