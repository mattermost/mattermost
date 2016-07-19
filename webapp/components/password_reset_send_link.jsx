// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import client from 'client/web_client.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';
import {Link} from 'react-router/es6';

class PasswordResetSendLink extends React.Component {
    constructor(props) {
        super(props);

        this.handleSendLink = this.handleSendLink.bind(this);

        this.state = {
            error: '',
            updateText: ''
        };
    }
    handleSendLink(e) {
        e.preventDefault();

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            this.setState({
                error: (
                    <FormattedMessage
                        id={'password_send.error'}
                        defaultMessage={'Please enter a valid email address.'}
                    />
                )
            });
            return;
        }

        // End of error checking clear error
        this.setState({
            error: ''
        });

        client.sendPasswordReset(
            email,
            () => {
                this.setState({
                    error: null,
                    updateText: (
                        <div className='reset-form alert alert-success'>
                            <FormattedHTMLMessage
                                id='password_send.link'
                                defaultMessage='<p>A password reset link has been sent to <b>{email}</b></p>'
                                values={{
                                    email
                                }}
                            />
                            <FormattedMessage
                                id={'password_send.checkInbox'}
                                defaultMessage={'Please check your inbox.'}
                            />
                        </div>
                    )
                });
                $(ReactDOM.findDOMNode(this.refs.reset_form)).hide();
            },
            (err) => {
                this.setState({
                    error: err.message,
                    update_text: null
                });
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
                <div className='signup-header'>
                    <Link to='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <h3>
                            <FormattedMessage
                                id='password_send.title'
                                defaultMessage='Password Reset'
                            />
                        </h3>
                        {this.state.updateText}
                        <form
                            onSubmit={this.handleSendLink}
                            ref='reset_form'
                        >
                            <p>
                                <FormattedMessage
                                    id='password_send.description'
                                    defaultMessage='To reset your password, enter the email address you used to sign up'
                                />
                            </p>
                            <div className={formClass}>
                                <input
                                    type='email'
                                    className='form-control'
                                    name='email'
                                    ref='email'
                                    placeholder={Utils.localizeMessage(
                                        'password_send.email',
                                        'Email'
                                    )}
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
            </div>
        );
    }
}

PasswordResetSendLink.defaultProps = {
};
PasswordResetSendLink.propTypes = {
    params: React.PropTypes.object.isRequired
};

export default PasswordResetSendLink;
