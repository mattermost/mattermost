// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isEmail} from 'mattermost-redux/utils/helpers';

type State = {
    error: JSX.Element|string|null;
    isEmailError: boolean;
    isCurrentPasswordError: boolean;
}

type Props = {
    user?: UserProfile;
    currentUserId: string;
    show: boolean;
    onModalSubmit: (user?: UserProfile) => void;
    onModalDismissed: () => void;
    actions: {
        patchUser: (user: UserProfile) => ActionResult;
    };
}

export default class ResetEmailModal extends React.PureComponent<Props, State> {
    private emailRef: React.RefObject<HTMLInputElement>;
    private currentPasswordRef: React.RefObject<HTMLInputElement>;
    public static defaultProps: Partial<Props> = {
        show: false,
    };

    public constructor(props: Props) {
        super(props);

        this.state = {
            error: null,
            isEmailError: false,
            isCurrentPasswordError: false,
        };

        this.emailRef = React.createRef();
        this.currentPasswordRef = React.createRef();
    }

    public componentDidUpdate(prevProps: Props): void {
        if (!prevProps.show && this.props.show) {
            this.resetState();
        }
    }

    private resetState = (): void => {
        this.setState({
            error: null,
            isEmailError: false,
            isCurrentPasswordError: false,
        });
    };

    private isEmailValid = (): boolean => {
        if (!this.emailRef.current || !this.emailRef.current.value || !isEmail(this.emailRef.current.value)) {
            const errMsg = (
                <FormattedMessage
                    id='user.settings.general.validEmail'
                    defaultMessage='Please enter a valid email address.'
                />
            );
            this.setState({error: errMsg, isEmailError: true});
            return false;
        }

        this.setState({error: null, isEmailError: false});
        return true;
    };

    private isCurrentPasswordValid = (): boolean => {
        if (!this.currentPasswordRef.current || !this.currentPasswordRef.current.value) {
            const errMsg = (
                <FormattedMessage
                    id='admin.reset_email.missing_current_password'
                    defaultMessage='Please enter your current password.'
                />
            );

            this.setState({error: errMsg, isCurrentPasswordError: true});
            return false;
        }
        this.setState({error: null, isCurrentPasswordError: false});
        return true;
    };

    private doSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (!this.props.user) {
            return;
        }

        if (!this.isEmailValid()) {
            return;
        }

        const user = {
            ...this.props.user,
            email: (this.emailRef.current as HTMLInputElement).value.trim().toLowerCase(),
        };

        if (this.props.user?.id === this.props.currentUserId) {
            if (!this.isCurrentPasswordValid()) {
                return;
            }
            user.password = (this.currentPasswordRef.current as HTMLInputElement).value;
        }

        const result = await this.props.actions.patchUser(user);
        if ('error' in result) {
            this.setState({
                error: result.error.message,
                isEmailError: result.error.server_error_id === 'app.user.save.email_exists.app_error',
                isCurrentPasswordError: result.error.server_error_id === 'api.user.check_user_password.invalid.app_error',
            });
            return;
        }

        this.props.onModalSubmit(this.props.user);
    };

    private doCancel = (): void => {
        this.setState({
            error: null,
        });
        this.props.onModalDismissed();
    };

    public render(): JSX.Element {
        const user = this.props.user;
        if (!user) {
            return <div/>;
        }

        const groupClass = 'input-group input-group--limit mb-5';

        const title = (
            <FormattedMessage
                id='admin.reset_email.titleReset'
                defaultMessage='Update Email'
            />
        );

        return (
            <Modal
                dialogClassName='a11y__modal'
                show={this.props.show}
                onHide={this.doCancel}
                role='dialog'
                aria-labelledby='resetEmailModalLabel'
                data-testid='resetEmailModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='resetEmailModalLabel'
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
                            <div className='col-sm-10'>
                                <div
                                    className={`${groupClass}${this.state.isEmailError ? ' has-error' : ''}`}
                                    data-testid='resetEmailForm'
                                >
                                    <span
                                        data-toggle='tooltip'
                                        title='New Email'
                                        className='input-group-addon email__group-addon'
                                    >
                                        <FormattedMessage
                                            id='admin.reset_email.newEmail'
                                            defaultMessage='New Email'
                                        />
                                    </span>
                                    <input
                                        type='email'
                                        ref={this.emailRef}
                                        className='form-control'
                                        maxLength={128}
                                        autoFocus={true}
                                    />
                                </div>

                                {this.props.user?.id === this.props.currentUserId && (
                                    <div
                                        className={`${groupClass}${this.state.isCurrentPasswordError ? ' has-error' : ''}`}
                                        data-testid='resetEmailForm'
                                    >
                                        <span
                                            data-toggle='tooltip'
                                            title='Current Password'
                                            className='input-group-addon email__group-addon'
                                        >
                                            <FormattedMessage
                                                id='admin.reset_email.currentPassword'
                                                defaultMessage='Current Password'
                                            />
                                        </span>
                                        <input
                                            type='password'
                                            ref={this.currentPasswordRef}
                                            className='form-control'
                                        />
                                    </div>
                                )}

                                {this.state.error && (
                                    <div className='has-error'>
                                        <p className='input__help error'>
                                            {this.state.error}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            onClick={this.doCancel}
                        >
                            <FormattedMessage
                                id='admin.reset_email.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            data-testid='resetEmailButton'
                        >
                            <FormattedMessage
                                id='admin.reset_email.reset'
                                defaultMessage='Reset'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
