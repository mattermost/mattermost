// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';

export default class PasswordResetSendLink extends React.Component {
    constructor(props) {
        super(props);

        this.handleSendLink = this.handleSendLink.bind(this);

        this.state = {};
    }
    handleSendLink(e) {
        e.preventDefault();
        var state = {};

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            state.error = 'Please enter a valid email address.';
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
                 this.setState({error: null, updateText: <p>A password reset link has been sent to <b>{email}</b> for your <b>{this.props.teamDisplayName}</b> team on {window.location.hostname}.</p>, moreUpdateText: 'Please check your inbox.'});
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
            updateText = <div className='reset-form alert alert-success'>{this.state.updateText}{this.state.moreUpdateText}</div>;
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
                    <h3>Password Reset</h3>
                    {updateText}
                    <form
                        onSubmit={this.handleSendLink}
                        ref='reset_form'
                    >
                        <p>{'To reset your password, enter the email address you used to sign up for ' + this.props.teamDisplayName + '.'}</p>
                        <div className={formClass}>
                            <input
                                type='email'
                                className='form-control'
                                name='email'
                                ref='email'
                                placeholder='Email'
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            Reset my password
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
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};
