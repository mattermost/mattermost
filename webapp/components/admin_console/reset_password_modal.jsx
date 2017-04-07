// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import {Modal} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import {adminResetPassword} from 'actions/admin_actions.jsx';

import React from 'react';

export default class ResetPasswordModal extends React.Component {
    static propTypes = {
        user: React.PropTypes.object,
        show: React.PropTypes.bool.isRequired,
        onModalSubmit: React.PropTypes.func,
        onModalDismissed: React.PropTypes.func
    };

    static defaultProps = {
        show: false
    };

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
        const password = this.refs.password.value;

        const passwordErr = Utils.isValidPassword(password);
        if (passwordErr) {
            this.setState({serverError: passwordErr});
            return;
        }
        this.setState({serverError: null});

        adminResetPassword(
            this.props.user.id,
            password,
            () => {
                this.props.onModalSubmit(this.props.user);
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
            serverError = <div className='has-error'><p className='input__help error'>{this.state.serverError}</p></div>;
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
