// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';
import {Modal} from 'react-bootstrap';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'react-intl';

var holders = defineMessages({
    submit: {
        id: 'admin.reset_password.submit',
        defaultMessage: 'Please enter at least {chars} characters.'
    }
});

import React from 'react';

class ResetPasswordModal extends React.Component {
    constructor(props) {
        super(props);

        this.doSubmit = this.doSubmit.bind(this);
        this.doCancel = this.doCancel.bind(this);

        this.state = {
            serverError: null
        };
    }

    doSubmit(e) {
        e.preventDefault();
        var password = ReactDOM.findDOMNode(this.refs.password).value;

        if (!password || password.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({serverError: this.props.intl.formatMessage(holders.submit, {chars: Constants.MIN_PASSWORD_LENGTH})});
            return;
        }

        this.setState({serverError: null});

        Client.adminResetPassword(
            this.props.user.id,
            password,
            () => {
                this.props.onModalSubmit(ReactDOM.findDOMNode(this.refs.password).value);
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    doCancel() {
        this.setState({serverError: null});
        this.props.onModalDismissed();
    }

    render() {
        const user = this.props.user;
        if (user == null) {
            return <div/>;
        }

        let urlClass = 'input-group input-group--limit';
        let serverError = null;

        if (this.state.serverError) {
            urlClass += ' has-error';
            serverError = <div className='form-group has-error'><p className='input__help error'>{this.state.serverError}</p></div>;
        }

        let title;
        if (user.auth_service) {
            title = (
                <FormattedMessage
                    id='admin.reset_password.titleSwitch'
                    defaultMessage='Switch Account to Email/Password'
                />
            );
        } else {
            title = (
                <FormattedMessage
                    id='admin.reset_password.titleReset'
                    defaultMessage='Reset Password'
                />
            );
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        {title}
                    </Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    className='form-horizontal'
                >
                    <Modal.Body>
                        <div className='form-group'>
                            <div className='col-sm-10'>
                                <div className={urlClass}>
                                    <span
                                        data-toggle='tooltip'
                                        title='New Password'
                                        className='input-group-addon'
                                    >
                                        <FormattedMessage
                                            id='admin.reset_password.newPassword'
                                            defaultMessage='New Password'
                                        />
                                    </span>
                                    <input
                                        type='password'
                                        ref='password'
                                        className='form-control'
                                        maxLength='22'
                                        autoFocus={true}
                                        tabIndex='1'
                                    />
                                </div>
                                {serverError}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.doCancel}
                        >
                            <FormattedMessage
                                id='admin.reset_password.close'
                                defaultMessage='Close'
                            />
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            tabIndex='2'
                        >
                            <FormattedMessage
                                id='admin.reset_password.select'
                                defaultMessage='Select'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

ResetPasswordModal.defaultProps = {
    show: false
};

ResetPasswordModal.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    team: React.PropTypes.object,
    show: React.PropTypes.bool.isRequired,
    onModalSubmit: React.PropTypes.func,
    onModalDismissed: React.PropTypes.func
};

export default injectIntl(ResetPasswordModal);
