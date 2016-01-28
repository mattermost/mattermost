// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    error: {
        id: 'password_send.error',
        defaultMessage: 'Please enter a valid email address.'
    },
    link: {
        id: 'password_send.link',
        defaultMessage: '<p>A password reset link has been sent to <b>{email}</b> for your <b>{teamDisplayName}</b> team on {hostname}.</p>'
    },
    checkInbox: {
        id: 'password_send.checkInbox',
        defaultMessage: 'Please check your inbox.'
    },
    email: {
        id: 'password_send.email',
        defaultMessage: 'Email'
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
        var state = {};
        const {formatMessage} = this.props.intl;

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            state.error = formatMessage(holders.error);
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var data = {};
        data.email = email;
        data.name = this.props.teamName;

        client.sendPasswordReset(data,
             function passwordResetSent() {
                 this.setState({error: null, updateText: formatMessage(holders.link, {email: email, teamDisplayName: this.props.teamDisplayName, hostname: window.location.hostname}), moreUpdateText: formatMessage(holders.checkInbox)});
                 $(ReactDOM.findDOMNode(this.refs.reset_form)).hide();
             }.bind(this),
             function passwordResetFailedToSend(err) {
                 this.setState({error: err.message, update_text: null, moreUpdateText: null});
             }.bind(this)
            );
    }
    render() {
        var updateText = null;
        if (this.state.updateText) {
            updateText = (
                <div className='reset-form alert alert-success'
                    dangerouslySetInnerHTML={{__html: this.state.updateText + this.state.moreUpdateText}}
                >
                </div>
            );
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
                            id='password_send.title'
                            defaultMessage='Password Reset'
                        />
                    </h3>
                    {updateText}
                    <form
                        onSubmit={this.handleSendLink}
                        ref='reset_form'
                    >
                        <p>
                            <FormattedMessage
                                id='password_send.description'
                                defaultMessage='To reset your password, enter the email address you used to sign up for {teamName}.'
                                values={{
                                    teamName: this.props.teamDisplayName
                                }}
                            />
                        </p>
                        <div className={formClass}>
                            <input
                                type='email'
                                className='form-control'
                                name='email'
                                ref='email'
                                placeholder={formatMessage(holders.email)}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='password_send.reset'
                                defaultMessage='Reset my password'
                            />
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