// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import type {UserProfile} from '@mattermost/types/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

interface PasswordConfig {
    minimumLength: number;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    requireUppercase: boolean;
}

type State = {
    serverErrorNewPass: React.ReactNode;
    serverErrorCurrentPass: React.ReactNode;
}

type Props = {
    user?: UserProfile;
    currentUserId: string;
    show: boolean;
    onModalSubmit: (user?: UserProfile) => void;
    onModalDismissed: () => void;
    passwordConfig: PasswordConfig;
    actions: {
        updateUserPassword: (userId: string, currentPassword: string, password: string) => ActionResult;
    };
}

export default class ResetPasswordModal extends React.PureComponent<Props, State> {
    private currentPasswordRef: React.RefObject<HTMLInputElement>;
    private passwordRef: React.RefObject<HTMLInputElement>;
    public static defaultProps: Partial<Props> = {
        show: false,
    };

    public constructor(props: Props) {
        super(props);

        this.state = {
            serverErrorNewPass: null,
            serverErrorCurrentPass: null,
        };

        this.currentPasswordRef = React.createRef();
        this.passwordRef = React.createRef();
    }

    public componentWillUnmount(): void {
        this.setState({
            serverErrorNewPass: null,
            serverErrorCurrentPass: null,
        });
    }

    private doSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (!this.props.user) {
            return;
        }

        let currentPassword = '';
        if (this.currentPasswordRef.current) {
            currentPassword = (this.currentPasswordRef.current as HTMLInputElement).value;
            if (currentPassword === '') {
                const errorMsg = (
                    <FormattedMessage
                        id='admin.reset_password.missing_current'
                        defaultMessage='Please enter your current password.'
                    />
                );
                this.setState({serverErrorCurrentPass: errorMsg});
                return;
            }
        }

        const password = (this.passwordRef.current as HTMLInputElement).value;

        const {valid, error} = Utils.isValidPassword(password, this.props.passwordConfig);
        if (!valid && error) {
            this.setState({serverErrorNewPass: error});
            return;
        }

        this.setState({serverErrorNewPass: null});

        const result = await this.props.actions.updateUserPassword(this.props.user.id, currentPassword, password);
        if ('error' in result) {
            this.setState({serverErrorCurrentPass: result.error.message});
            return;
        }
        this.props.onModalSubmit(this.props.user);
    };

    private doCancel = (): void => {
        this.setState({
            serverErrorNewPass: null,
            serverErrorCurrentPass: null,
        });
        this.props.onModalDismissed();
    };

    public render(): JSX.Element {
        const user = this.props.user;
        if (user == null) {
            return <div/>;
        }

        let urlClass = 'input-group input-group--limit';
        let serverErrorNewPass = null;

        if (this.state.serverErrorNewPass) {
            urlClass += ' has-error';
            serverErrorNewPass = <div className='has-error'><p className='input__help error'>{this.state.serverErrorNewPass}</p></div>;
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

        let currentPassword = null;
        let serverErrorCurrentPass = null;
        let newPasswordFocus = true;
        if (this.props.currentUserId === user.id) {
            newPasswordFocus = false;
            let urlClassCurrentPass = 'input-group input-group--limit';
            if (this.state.serverErrorCurrentPass) {
                urlClassCurrentPass += ' has-error';
                serverErrorCurrentPass = <div className='has-error'><p className='input__help error'>{this.state.serverErrorCurrentPass}</p></div>;
            }
            currentPassword = (
                <div className='col-sm-10 password__group-addon-space'>
                    <div className={urlClassCurrentPass}>
                        <span
                            data-toggle='tooltip'
                            title='Current Password'
                            className='input-group-addon password__group-addon'
                        >
                            <FormattedMessage
                                id='admin.reset_password.curentPassword'
                                defaultMessage='Current Password'
                            />
                        </span>
                        <input
                            type='password'
                            ref={this.currentPasswordRef}
                            className='form-control'
                            autoFocus={true}
                        />
                    </div>
                </div>
            );
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.props.show}
                onHide={this.doCancel}
                role='dialog'
                aria-labelledby='resetPasswordModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='resetPasswordModalLabel'
                    >
                        {title}
                    </Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    className='form-horizontal'
                >
                    <Modal.Body>
                        <div className='form-group'>
                            {currentPassword}
                            <div className='col-sm-10'>
                                <div className={urlClass}>
                                    <span
                                        data-toggle='tooltip'
                                        title='New Password'
                                        className='input-group-addon password__group-addon'
                                    >
                                        <FormattedMessage
                                            id='admin.reset_password.newPassword'
                                            defaultMessage='New Password'
                                        />
                                    </span>
                                    <input
                                        type='password'
                                        ref={this.passwordRef}
                                        className='form-control'
                                        autoFocus={newPasswordFocus}
                                    />
                                </div>
                                {serverErrorNewPass}
                                {serverErrorCurrentPass}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-link'
                            onClick={this.doCancel}
                        >
                            <FormattedMessage
                                id='admin.reset_password.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='admin.reset_password.reset'
                                defaultMessage='Reset'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
